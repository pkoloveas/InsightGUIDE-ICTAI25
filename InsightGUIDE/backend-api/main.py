import logging
import ipaddress
import socket
import asyncio
from contextlib import asynccontextmanager
from typing import Optional, Set, Tuple
from urllib.parse import urlparse, unquote

import httpx
import uvicorn
from fastapi import FastAPI, File, UploadFile, HTTPException, status, Depends, Request, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import Config, load_config
from exceptions import (
    PDFInsightsError, 
    ConfigurationError, 
    OCRProcessingError, 
    AIInsightsError
)
from models import PDFProcessResponse, OCRResponse, ErrorResponse, HealthResponse, PDFURLRequest
from services import APIClientService, OCRService, InsightsService, FileService
from utils import setup_logging, validate_file_size, format_file_size

logger = logging.getLogger(__name__)

ALLOWED_PDF_CONTENT_TYPES = {"application/pdf", "application/x-pdf"}
ALLOWED_URL_CONTENT_TYPES = ALLOWED_PDF_CONTENT_TYPES | {"application/octet-stream"}


class AppState:
    """Application state container to avoid global variables."""
    
    def __init__(self):
        self.config: Optional[Config] = None
        self.api_client_service: Optional[APIClientService] = None
        self.ocr_service: Optional[OCRService] = None
        self.insights_service: Optional[InsightsService] = None
        self.file_service: Optional[FileService] = None
        self.initialized = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    state = AppState()
    
    try:
        # Load configuration
        state.config = load_config()
        setup_logging(state.config.log_level)
        
        logger.info("Starting InsightGUIDE API")
        
        # Initialize services
        state.api_client_service = APIClientService(state.config)
        state.ocr_service = OCRService(state.api_client_service.mistral_client)
        state.insights_service = InsightsService(
            state.api_client_service.openai_client, 
            state.config
        )
        state.file_service = FileService(state.config)
        state.initialized = True
        
        # Store state in app
        app.state.app_state = state
        
        logger.info("Application initialized successfully")
        yield
        
    except Exception as e:
        logger.error(f"Failed to initialize application: {e}")
        raise ConfigurationError(f"Application startup failed: {e}")
    finally:
        logger.info("Shutting down InsightGUIDE API")


# Load config early to get frontend URL for CORS
try:
    _early_config = load_config()
    _frontend_origins = [_early_config.frontend_url]
except Exception:
    # Fallback if config loading fails
    _frontend_origins = ["http://localhost:9002"]

# Initialize FastAPI app
app = FastAPI(
    title="InsightGUIDE API",
    description="AI-powered scientific paper analysis and insights generation",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add CORS middleware with proper frontend URL
app.add_middleware(
    CORSMiddleware,
    allow_origins=_frontend_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def get_app_state(request: Request) -> AppState:
    """Dependency to get application state."""
    state = getattr(request.app.state, 'app_state', None)
    if not state or not state.initialized:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Application not properly initialized"
        )
    return state


def get_config(state: AppState = Depends(get_app_state)) -> Config:
    """Dependency to get application configuration."""
    if state.config is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Application configuration not available"
        )
    return state.config


def get_ocr_service(state: AppState = Depends(get_app_state)) -> OCRService:
    """Dependency to get OCR service."""
    if state.ocr_service is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="OCR service not available"
        )
    return state.ocr_service


def get_insights_service(state: AppState = Depends(get_app_state)) -> InsightsService:
    """Dependency to get insights service."""
    if state.insights_service is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Insights service not available"
        )
    return state.insights_service


def get_file_service(state: AppState = Depends(get_app_state)) -> FileService:
    """Dependency to get file service."""
    if state.file_service is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="File service not available"
        )
    return state.file_service


def _extract_filename_from_url(pdf_url: str) -> str:
    """Extract a best-effort filename from a URL."""
    parsed_url = urlparse(pdf_url)
    filename = unquote(parsed_url.path.rsplit("/", 1)[-1]) if parsed_url.path else ""

    if not filename:
        filename = "document.pdf"

    if not filename.lower().endswith(".pdf"):
        filename = f"{filename}.pdf"

    return filename


def _raise_invalid_url(detail: str) -> None:
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=detail
    )


def _is_restricted_ip_address(ip_obj) -> bool:
    return (
        ip_obj.is_private
        or ip_obj.is_loopback
        or ip_obj.is_link_local
        or ip_obj.is_multicast
        or ip_obj.is_reserved
        or ip_obj.is_unspecified
    )


async def _validate_public_hostname(hostname: str, validated_hosts: Optional[Set[str]] = None) -> None:
    normalized_hostname = hostname.lower()
    if validated_hosts is not None and normalized_hostname in validated_hosts:
        return

    try:
        loop = asyncio.get_running_loop()
        addr_info = await loop.getaddrinfo(
            normalized_hostname,
            None,
            type=socket.SOCK_STREAM
        )
    except socket.gaierror:
        logger.warning(f"Failed to resolve hostname for PDF URL: {normalized_hostname}")
        _raise_invalid_url("Failed to resolve PDF URL host")
    except OSError as e:
        logger.warning(f"Error resolving hostname for PDF URL {normalized_hostname}: {e}")
        _raise_invalid_url("Failed to resolve PDF URL host")

    if not addr_info:
        logger.warning(f"No addresses resolved for PDF URL host: {normalized_hostname}")
        _raise_invalid_url("Failed to resolve PDF URL host")

    for info in addr_info:
        sockaddr = info[4]
        if not sockaddr:
            continue

        ip_raw = sockaddr[0]
        try:
            ip_obj = ipaddress.ip_address(ip_raw)
        except ValueError:
            logger.warning(f"Ignoring unparseable resolved IP '{ip_raw}' for host {normalized_hostname}")
            continue

        if _is_restricted_ip_address(ip_obj):
            logger.warning(
                f"Rejected PDF URL host {normalized_hostname}: resolved to restricted address {ip_obj}"
            )
            _raise_invalid_url("PDF URL points to a restricted network address")

    if validated_hosts is not None:
        validated_hosts.add(normalized_hostname)


async def _validate_https_pdf_url(pdf_url: str, validated_hosts: Optional[Set[str]] = None):
    parsed_url = urlparse(pdf_url)
    if parsed_url.scheme.lower() != "https" or not parsed_url.netloc:
        _raise_invalid_url("Invalid PDF URL. Please provide a valid HTTPS URL.")

    if parsed_url.username or parsed_url.password:
        _raise_invalid_url("PDF URL cannot include embedded credentials")

    if not parsed_url.hostname:
        _raise_invalid_url("Invalid PDF URL. Please provide a valid HTTPS URL.")

    await _validate_public_hostname(parsed_url.hostname, validated_hosts)
    return parsed_url


async def download_pdf_from_url(pdf_url: str, max_file_size: int) -> Tuple[str, bytes]:
    """Download PDF bytes from URL and validate type and size constraints."""
    max_redirects = 5
    validated_hosts: Set[str] = set()

    filename = _extract_filename_from_url(pdf_url)

    try:
        async with httpx.AsyncClient(
            follow_redirects=False,
            timeout=httpx.Timeout(30.0, connect=10.0)
        ) as client:
            current_url = pdf_url
            pdf_bytes_buffer = bytearray()

            for _ in range(max_redirects + 1):
                await _validate_https_pdf_url(current_url, validated_hosts)

                async with client.stream("GET", current_url) as response:
                    if response.status_code in {301, 302, 303, 307, 308}:
                        redirect_location = response.headers.get("location")
                        if not redirect_location:
                            logger.warning(f"Redirect response missing location header: {current_url}")
                            raise HTTPException(
                                status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Failed to download PDF from URL"
                            )
                        current_url = str(response.request.url.join(redirect_location))
                        continue

                    response.raise_for_status()

                    content_type = response.headers.get("content-type", "").split(";")[0].strip().lower()
                    if content_type and content_type not in ALLOWED_URL_CONTENT_TYPES:
                        logger.warning(f"Invalid content type from URL {current_url}: {content_type}")
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="URL does not point to a PDF file"
                        )

                    content_length_header = response.headers.get("content-length")
                    if content_length_header:
                        try:
                            content_length = int(content_length_header)
                        except ValueError:
                            content_length = None

                        if content_length and not validate_file_size(content_length, max_file_size):
                            logger.warning(f"URL file too large: {format_file_size(content_length)}")
                            raise HTTPException(
                                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                                detail=f"File too large. Maximum size: {format_file_size(max_file_size)}"
                            )

                    async for chunk in response.aiter_bytes():
                        if not chunk:
                            continue

                        pdf_bytes_buffer.extend(chunk)
                        if not validate_file_size(len(pdf_bytes_buffer), max_file_size):
                            logger.warning(f"URL file too large while streaming: {format_file_size(len(pdf_bytes_buffer))}")
                            raise HTTPException(
                                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                                detail=f"File too large. Maximum size: {format_file_size(max_file_size)}"
                            )
                    break
            else:
                logger.warning(f"Too many redirects while downloading PDF URL: {pdf_url}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Too many redirects while downloading PDF URL"
                )

    except HTTPException:
        raise
    except httpx.HTTPStatusError as e:
        logger.error(f"Failed to download PDF from URL (status {e.response.status_code}): {pdf_url}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to download PDF from URL"
        )
    except httpx.RequestError as e:
        logger.error(f"Failed to download PDF from URL: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to download PDF from URL"
        )

    pdf_bytes = bytes(pdf_bytes_buffer)
    if not pdf_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Downloaded file is empty"
        )

    if not pdf_bytes.startswith(b"%PDF-"):
        logger.warning(f"Downloaded file from URL is not a valid PDF: {pdf_url}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File does not appear to be a valid PDF"
        )

    return filename, pdf_bytes


async def resolve_pdf_input(
    pdf_file: Optional[UploadFile],
    pdf_url: Optional[str],
    config: Config
) -> Tuple[str, bytes]:
    """Resolve PDF input from either uploaded file or URL with shared validation."""
    if pdf_file and pdf_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide either pdf_file or pdf_url, not both"
        )

    if not pdf_file and not pdf_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide either a PDF file or a PDF URL"
        )

    if pdf_url:
        return await download_pdf_from_url(pdf_url.strip(), config.max_file_size)

    if pdf_file is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide either a PDF file or a PDF URL"
        )

    if pdf_file.content_type not in ALLOWED_PDF_CONTENT_TYPES:
        logger.warning(f"Invalid file type uploaded: {pdf_file.content_type}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Please upload a PDF file."
        )

    if not pdf_file.filename or not pdf_file.filename.lower().endswith('.pdf'):
        logger.warning(f"Invalid filename: {pdf_file.filename}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid filename. Please ensure the file has a .pdf extension."
        )

    try:
        pdf_bytes = await pdf_file.read()
    except Exception as e:
        logger.error(f"Failed to read uploaded file: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to read uploaded file"
        )

    file_size = len(pdf_bytes)
    if not validate_file_size(file_size, config.max_file_size):
        logger.warning(f"File too large: {format_file_size(file_size)}")
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size: {format_file_size(config.max_file_size)}"
        )

    if not pdf_bytes.startswith(b'%PDF-'):
        logger.warning("File does not appear to be a valid PDF")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File does not appear to be a valid PDF"
        )

    return pdf_file.filename, pdf_bytes


# Exception handlers
@app.exception_handler(PDFInsightsError)
async def pdf_insights_exception_handler(request: Request, exc: PDFInsightsError):
    """Handle custom application exceptions."""
    logger.error(f"Application error: {exc}")
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content=ErrorResponse(
            detail=str(exc),
            error_type=type(exc).__name__
        ).model_dump()
    )


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    """Handle validation errors."""
    logger.error(f"Validation error: {exc}")
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content=ErrorResponse(
            detail=str(exc),
            error_type="ValidationError"
        ).model_dump()
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions."""
    logger.error(f"Unexpected error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=ErrorResponse(
            detail="An unexpected error occurred",
            error_type="InternalServerError"
        ).model_dump()
    )


# API Routes
@app.get(
    "/health",
    response_model=HealthResponse,
    summary="Health check endpoint",
    tags=["Health"]
)
async def health_check():
    """Check API health status."""
    return HealthResponse(status="healthy", version="1.0.0")


@app.post(
    "/api/process-pdf/",
    response_model=PDFProcessResponse,
    summary="Process PDF and generate insights",
    description="Upload a PDF file or provide a PDF URL to extract content and generate AI-powered insights",
    tags=["PDF Processing"]
)
async def process_pdf_endpoint(
    pdf_file: Optional[UploadFile] = File(
        None,
        description="PDF file to process",
        media_type="application/pdf"
    ),
    pdf_url: Optional[str] = Form(
        None,
        description="Public URL to a PDF document"
    ),
    config: Config = Depends(get_config),
    ocr_service: OCRService = Depends(get_ocr_service),
    insights_service: InsightsService = Depends(get_insights_service),
    file_service: FileService = Depends(get_file_service)
):
    """Process PDF input (uploaded file or URL) and generate insights."""
    source_filename, pdf_bytes = await resolve_pdf_input(pdf_file, pdf_url, config)
    logger.info(f"Processing PDF: {source_filename}, size: {format_file_size(len(pdf_bytes))}")
    
    try:
        # Extract content using OCR
        extracted_content = await ocr_service.process_pdf(source_filename, pdf_bytes)
        
        # Save extracted content if enabled
        if config.save_extracted_content:
            file_service.save_extracted_content(extracted_content, source_filename)
        
        # Generate insights
        insights = await insights_service.generate_insights(extracted_content)
        
        return PDFProcessResponse(
            insights=insights,
            filename=source_filename
        )
        
    except (OCRProcessingError, AIInsightsError):
        raise
    except Exception as e:
        logger.error(f"Unexpected error processing PDF: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while processing the PDF"
        )


@app.post(
    "/api/process-pdf-url/",
    response_model=PDFProcessResponse,
    summary="Process PDF from URL and generate insights",
    description="Provide a PDF URL in JSON payload to extract content and generate AI-powered insights",
    tags=["PDF Processing"]
)
async def process_pdf_url_endpoint(
    payload: PDFURLRequest,
    config: Config = Depends(get_config),
    ocr_service: OCRService = Depends(get_ocr_service),
    insights_service: InsightsService = Depends(get_insights_service),
    file_service: FileService = Depends(get_file_service)
):
    """Process PDF from URL and generate insights."""
    source_filename, pdf_bytes = await resolve_pdf_input(None, payload.pdf_url, config)
    logger.info(f"Processing PDF from URL: {source_filename}, size: {format_file_size(len(pdf_bytes))}")

    try:
        extracted_content = await ocr_service.process_pdf(source_filename, pdf_bytes)

        if config.save_extracted_content:
            file_service.save_extracted_content(extracted_content, source_filename)

        insights = await insights_service.generate_insights(extracted_content)

        return PDFProcessResponse(
            insights=insights,
            filename=source_filename
        )

    except (OCRProcessingError, AIInsightsError):
        raise
    except Exception as e:
        logger.error(f"Unexpected error processing PDF URL: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while processing the PDF"
        )


@app.post(
    "/api/extract-text/",
    response_model=OCRResponse,
    summary="Extract text from PDF using OCR",
    description="Upload a PDF file or provide a PDF URL to extract text content without generating AI insights",
    tags=["PDF Processing"]
)
async def extract_text_endpoint(
    pdf_file: Optional[UploadFile] = File(
        None,
        description="PDF file to extract text from",
        media_type="application/pdf"
    ),
    pdf_url: Optional[str] = Form(
        None,
        description="Public URL to a PDF document"
    ),
    config: Config = Depends(get_config),
    ocr_service: OCRService = Depends(get_ocr_service),
    file_service: FileService = Depends(get_file_service)
):
    """Extract text content from PDF input (uploaded file or URL) using OCR."""
    source_filename, pdf_bytes = await resolve_pdf_input(pdf_file, pdf_url, config)
    logger.info(f"Extracting text from PDF: {source_filename}, size: {format_file_size(len(pdf_bytes))}")
    
    try:
        # Extract content using OCR
        extracted_content = await ocr_service.process_pdf(source_filename, pdf_bytes)
        
        # Save extracted content if enabled
        if config.save_extracted_content:
            file_service.save_extracted_content(extracted_content, source_filename)
        
        return OCRResponse(
            extracted_content=extracted_content,
            filename=source_filename
        )
        
    except OCRProcessingError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error extracting text from PDF: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while extracting text from the PDF"
        )


@app.post(
    "/api/extract-text-url/",
    response_model=OCRResponse,
    summary="Extract text from PDF URL using OCR",
    description="Provide a PDF URL in JSON payload to extract text content without generating AI insights",
    tags=["PDF Processing"]
)
async def extract_text_url_endpoint(
    payload: PDFURLRequest,
    config: Config = Depends(get_config),
    ocr_service: OCRService = Depends(get_ocr_service),
    file_service: FileService = Depends(get_file_service)
):
    """Extract text content from a PDF URL using OCR."""
    source_filename, pdf_bytes = await resolve_pdf_input(None, payload.pdf_url, config)
    logger.info(f"Extracting text from PDF URL: {source_filename}, size: {format_file_size(len(pdf_bytes))}")

    try:
        extracted_content = await ocr_service.process_pdf(source_filename, pdf_bytes)

        if config.save_extracted_content:
            file_service.save_extracted_content(extracted_content, source_filename)

        return OCRResponse(
            extracted_content=extracted_content,
            filename=source_filename
        )

    except OCRProcessingError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error extracting text from PDF URL: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while extracting text from the PDF"
        )


if __name__ == "__main__":
    try:
        config = load_config()
        logger.info(f"Starting server on {config.host}:{config.port}")
        uvicorn.run(
            "main:app",
            host=config.host,
            port=config.port,
            log_level=config.log_level.lower(),
            reload=False,
            access_log=True
        )
    except Exception as e:
        logger.error(f"Failed to start application: {e}")
        exit(1)
