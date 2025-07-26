import asyncio
import logging
from pathlib import Path
from typing import Any, Dict, Optional

from mistralai import Mistral, DocumentURLChunk
from mistralai.models.ocrresponse import OCRResponse
from openai import AsyncOpenAI

from config import Config
from exceptions import OCRProcessingError, AIInsightsError
from utils import replace_images_in_markdown, safe_filename, ensure_directory_exists, fix_markdown_urls

logger = logging.getLogger(__name__)


class APIClientService:
    """Service for managing API clients."""
    
    def __init__(self, config: Config):
        self.config = config
        self._mistral_client: Optional[Mistral] = None
        self._openai_client: Optional[AsyncOpenAI] = None
    
    @property
    def mistral_client(self) -> Mistral:
        """Get or create Mistral client."""
        if self._mistral_client is None:
            self._mistral_client = Mistral(api_key=self.config.mistral_api_key)
            logger.info("Mistral client initialized")
        return self._mistral_client
    
    @property
    def openai_client(self) -> AsyncOpenAI:
        """Get or create AsyncOpenAI client."""
        if self._openai_client is None:
            client_kwargs = {"api_key": self.config.openai_api_key}
            
            if self.config.openai_api_host:
                logger.info(f"Using custom OpenAI API host: {self.config.openai_api_host}")
                client_kwargs["base_url"] = self.config.openai_api_host
            else:
                logger.info("Using default OpenAI API host")
                
            self._openai_client = AsyncOpenAI(**client_kwargs)
            logger.info("AsyncOpenAI client initialized")
        return self._openai_client


class OCRService:
    """Service for handling OCR processing with Mistral AI."""
    
    def __init__(self, mistral_client: Mistral):
        self.mistral_client = mistral_client
    
    def get_combined_markdown(self, ocr_response: OCRResponse) -> str:
        """Combine OCR text and images into a single markdown document."""
        if not ocr_response.pages:
            logger.warning("OCR response contains no pages")
            return ""
            
        markdowns = []
        
        for page in ocr_response.pages:
            image_data = {}
            if page.images:
                for img in page.images:
                    if img.id and img.image_base64:
                        image_data[img.id] = img.image_base64
            
            page_markdown = replace_images_in_markdown(page.markdown, image_data)
            markdowns.append(page_markdown)
        
        return "\n\n".join(markdowns)
    
    async def process_pdf(self, pdf_filename: Optional[str], pdf_bytes: bytes) -> str:
        """Process PDF with Mistral OCR and return combined markdown."""
        if not pdf_bytes:
            raise OCRProcessingError("Empty PDF bytes provided")
            
        logger.info("Starting OCR processing with Mistral AI")
        uploaded_file = None
        
        try:
            uploaded_file = self.mistral_client.files.upload(
                file={
                    "file_name": pdf_filename or "document.pdf",
                    "content": pdf_bytes,
                },
                purpose="ocr"
            )
            
            if not hasattr(uploaded_file, 'id'):
                raise OCRProcessingError(
                    f"Invalid response from Mistral API: {uploaded_file}"
                )
            
            signed_url = self.mistral_client.files.get_signed_url(
                file_id=uploaded_file.id, 
                expiry=1
            )
            logger.info(f"File uploaded with ID: {uploaded_file.id}")
            
            ocr_response = self.mistral_client.ocr.process(
                document=DocumentURLChunk(document_url=signed_url.url),
                model="mistral-ocr-latest",
                include_image_base64=False
            )
            
            logger.info(f"OCR processing completed for file ID: {uploaded_file.id}")
            return self.get_combined_markdown(ocr_response)
            
        except Exception as e:
            logger.error(f"OCR processing failed: {e}")
            raise OCRProcessingError(f"Failed to process PDF with OCR: {str(e)}")
        
        finally:
            if uploaded_file and hasattr(uploaded_file, 'id'):
                try:
                    self.mistral_client.files.delete(file_id=uploaded_file.id)
                    logger.info(f"Cleaned up Mistral file ID: {uploaded_file.id}")
                except Exception as e:
                    logger.error(f"Failed to delete Mistral file {uploaded_file.id}: {e}")


class InsightsService:
    """Service for generating AI insights from extracted content."""
    
    def __init__(self, openai_client: AsyncOpenAI, config: Config):
        self.openai_client = openai_client
        self.config = config
    
    async def generate_insights(self, extracted_content: str) -> str:
        """Generate AI insights from extracted markdown content."""
        if not extracted_content or not extracted_content.strip():
            logger.warning("Empty content provided for insights generation")
            extracted_content = "The document appears to be empty or no text could be extracted."
        
        logger.info(f"Generating insights using model: {self.config.model}")
        
        try:
            response = await self.openai_client.chat.completions.create(
                messages=[
                    {
                        "role": "system",
                        "content": self.config.system_prompt
                    },
                    {
                        "role": "user", 
                        "content": extracted_content
                    }
                ],
                model=self.config.model,
                temperature=0.7
            )
            
            insights = response.choices[0].message.content
            if not insights:
                logger.warning("AI model returned empty insights")
                return "Could not generate insights for the provided document."
            
            insights = fix_markdown_urls(insights)
            
            logger.info("Successfully generated AI insights")
            return insights
            
        except Exception as e:
            logger.error(f"Failed to generate insights: {e}")
            raise AIInsightsError(f"Failed to generate insights: {str(e)}")


class FileService:
    """Service for handling file operations."""
    
    def __init__(self, config: Config):
        self.config = config
        self.output_dir = ensure_directory_exists(config.output_dir)
    
    def save_extracted_content(self, content: str, original_filename: Optional[str]) -> Path:
        """Save extracted content to file."""
        if not content:
            logger.warning("Empty content provided for saving")
            content = "No content extracted from document."
            
        if original_filename:
            base_name = original_filename
            if base_name.lower().endswith('.pdf'):
                base_name = base_name[:-4]
            safe_name = safe_filename(base_name)
            output_filename = f"extracted_{safe_name}.md"
        else:
            output_filename = "extracted_document.md"
        
        output_path = self.output_dir / output_filename
        
        try:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            logger.info(f"Saved extracted content to: {output_path}")
            return output_path
        except Exception as e:
            logger.error(f"Failed to save extracted content: {e}")
            raise OSError(f"Failed to save extracted content: {e}")
