from pydantic import BaseModel, Field, ConfigDict
from typing import Optional


class PDFProcessResponse(BaseModel):
    """Response model for PDF processing endpoint."""
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "insights": "This research paper presents a novel approach to...",
                "filename": "research_paper.pdf"
            }
        }
    )
    
    insights: str = Field(
        ..., 
        description="Generated insights from the PDF document",
        min_length=1
    )
    filename: Optional[str] = Field(
        None, 
        description="Original filename of the processed PDF"
    )


class OCRResponse(BaseModel):
    """Response model for OCR-only processing endpoint."""
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "extracted_content": "# Research Paper Title\n\nThis is the extracted text from the PDF...",
                "filename": "research_paper.pdf"
            }
        }
    )
    
    extracted_content: str = Field(
        ..., 
        description="Extracted text content from the PDF document in markdown format",
        min_length=1
    )
    filename: Optional[str] = Field(
        None, 
        description="Original filename of the processed PDF"
    )


class ErrorResponse(BaseModel):
    """Error response model."""
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "detail": "Invalid file type. Please upload a PDF.",
                "error_type": "ValidationError"
            }
        }
    )
    
    detail: str = Field(
        ..., 
        description="Error message",
        min_length=1
    )
    error_type: Optional[str] = Field(
        None, 
        description="Type of error that occurred"
    )


class HealthResponse(BaseModel):
    """Health check response model."""
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status": "healthy",
                "version": "1.0.0"
            }
        }
    )
    
    status: str = Field(
        ..., 
        description="Service status",
        pattern="^(healthy|unhealthy)$"
    )
    version: str = Field(
        ..., 
        description="API version"
    )
