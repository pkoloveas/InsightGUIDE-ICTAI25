import logging
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, File, UploadFile, HTTPException, status, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import Config, load_config
from exceptions import (
    PDFInsightsError, 
    ConfigurationError, 
    OCRProcessingError, 
    AIInsightsError
)
from models import PDFProcessResponse, OCRResponse, ErrorResponse, HealthResponse
from services import APIClientService, OCRService, InsightsService, FileService
from utils import setup_logging, validate_file_size, format_file_size

logger = logging.getLogger(__name__)


class AppState:
    """Application state container to avoid global variables."""
    
    def __init__(self):
        self.config: Config = None
        self.api_client_service: APIClientService = None
        self.ocr_service: OCRService = None
        self.insights_service: InsightsService = None
        self.file_service: FileService = None
        self.initialized = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    state = AppState()
    
    try:
        state.config = load_config()
        setup_logging(state.config.log_level)
        
        logger.info("Starting InsightGUIDE API")
        
        state.api_client_service = APIClientService(state.config)
        state.ocr_service = OCRService(state.api_client_service.mistral_client)
        state.insights_service = InsightsService(
            state.api_client_service.openai_client, 
            state.config
        )
        state.file_service = FileService(state.config)
        state.initialized = True
        
        app.state.app_state = state
        
        logger.info("Application initialized successfully")
        yield
        
    except Exception as e:
        logger.error(f"Failed to initialize application: {e}")
        raise ConfigurationError(f"Application startup failed: {e}")
    finally:
        logger.info("Shutting down InsightGUIDE API")


try:
    _early_config = load_config()
    _frontend_origins = [_early_config.frontend_url]
except Exception:
    _frontend_origins = ["http://localhost:9002"]

app = FastAPI(
    title="InsightGUIDE API",
    description="AI-powered scientific paper analysis and insights generation",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

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
    return state.config


def get_ocr_service(state: AppState = Depends(get_app_state)) -> OCRService:
    """Dependency to get OCR service."""
    return state.ocr_service


def get_insights_service(state: AppState = Depends(get_app_state)) -> InsightsService:
    """Dependency to get insights service."""
    return state.insights_service


def get_file_service(state: AppState = Depends(get_app_state)) -> FileService:
    """Dependency to get file service."""
    return state.file_service


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
    description="Upload a PDF file to extract content and generate AI-powered insights",
    tags=["PDF Processing"]
)
async def process_pdf_endpoint(
    pdf_file: UploadFile = File(
        ...,
        description="PDF file to process",
        media_type="application/pdf"
    ),
    config: Config = Depends(get_config),
    ocr_service: OCRService = Depends(get_ocr_service),
    insights_service: InsightsService = Depends(get_insights_service),
    file_service: FileService = Depends(get_file_service)
):
    """Process uploaded PDF file and generate insights."""
    
    if pdf_file.content_type not in ["application/pdf", "application/x-pdf"]:
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
    
    # Validate file content (basic PDF signature check)
    if not pdf_bytes.startswith(b'%PDF-'):
        logger.warning("File does not appear to be a valid PDF")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File does not appear to be a valid PDF"
        )
    
    logger.info(f"Processing PDF: {pdf_file.filename}, size: {format_file_size(file_size)}")
    
    try:
        extracted_content = await ocr_service.process_pdf(pdf_file.filename, pdf_bytes)
        
        if config.save_extracted_content:
            file_service.save_extracted_content(extracted_content, pdf_file.filename)
        
        insights = await insights_service.generate_insights(extracted_content)
        
        return PDFProcessResponse(
            insights=insights,
            filename=pdf_file.filename
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
    "/api/extract-text/",
    response_model=OCRResponse,
    summary="Extract text from PDF using OCR",
    description="Upload a PDF file to extract text content without generating AI insights",
    tags=["PDF Processing"]
)
async def extract_text_endpoint(
    pdf_file: UploadFile = File(
        ...,
        description="PDF file to extract text from",
        media_type="application/pdf"
    ),
    config: Config = Depends(get_config),
    ocr_service: OCRService = Depends(get_ocr_service),
    file_service: FileService = Depends(get_file_service)
):
    """Extract text content from uploaded PDF file using OCR."""
    
    if pdf_file.content_type not in ["application/pdf", "application/x-pdf"]:
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
    
    logger.info(f"Extracting text from PDF: {pdf_file.filename}, size: {format_file_size(file_size)}")
    
    try:
        extracted_content = await ocr_service.process_pdf(pdf_file.filename, pdf_bytes)
        
        if config.save_extracted_content:
            file_service.save_extracted_content(extracted_content, pdf_file.filename)
        
        return OCRResponse(
            extracted_content=extracted_content,
            filename=pdf_file.filename
        )
        
    except OCRProcessingError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error extracting text from PDF: {e}", exc_info=True)
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
