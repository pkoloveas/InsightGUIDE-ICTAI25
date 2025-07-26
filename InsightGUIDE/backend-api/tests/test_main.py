"""Tests for the main API endpoints."""

import pytest
from unittest.mock import patch, Mock
from fastapi.testclient import TestClient
from io import BytesIO

from main import app


class TestHealthEndpoint:
    """Test the health check endpoint."""
    
    def test_health_check(self):
        """Test health check returns expected response."""
        client = TestClient(app)
        response = client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["version"] == "1.0.0"


class TestPDFProcessingEndpoint:
    """Test the PDF processing endpoint."""
    
    @pytest.fixture
    def mock_services(self):
        """Mock all services for testing."""
        with patch('main.get_app_state') as mock_state:
            mock_app_state = Mock()
            mock_app_state.config = Mock(max_file_size=10*1024*1024)
            mock_app_state.ocr_service = Mock()
            mock_app_state.insights_service = Mock()
            mock_app_state.file_service = Mock()
            mock_app_state.initialized = True

            mock_app_state.ocr_service.process_pdf.return_value = "Extracted content"
            mock_app_state.insights_service.generate_insights.return_value = "Generated insights"
            mock_app_state.file_service.save_extracted_content.return_value = None
            
            mock_state.return_value = mock_app_state
            yield mock_app_state
    
    def test_process_pdf_invalid_content_type(self, mock_services):
        """Test PDF processing with invalid content type."""
        client = TestClient(app)
        
        file_content = b"Not a PDF file"
        response = client.post(
            "/api/process-pdf/",
            files={"pdf_file": ("test.txt", file_content, "text/plain")}
        )
        
        assert response.status_code == 400
        assert "Invalid file type" in response.json()["detail"]
    
    def test_process_pdf_invalid_filename(self, mock_services):
        """Test PDF processing with invalid filename."""
        client = TestClient(app)
        
        file_content = b"%PDF-1.4 content"
        response = client.post(
            "/api/process-pdf/",
            files={"pdf_file": ("test.txt", file_content, "application/pdf")}
        )
        
        assert response.status_code == 400
        assert "Invalid filename" in response.json()["detail"]
    
    def test_process_pdf_invalid_pdf_content(self, mock_services):
        """Test PDF processing with invalid PDF content."""
        client = TestClient(app)
        
        file_content = b"Not PDF content"
        response = client.post(
            "/api/process-pdf/",
            files={"pdf_file": ("test.pdf", file_content, "application/pdf")}
        )
        
        assert response.status_code == 400
        assert "does not appear to be a valid PDF" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_process_pdf_success(self, mock_services):
        """Test successful PDF processing."""
        client = TestClient(app)
        
        file_content = b"%PDF-1.4\nPDF content here"
        
        with patch.object(mock_services.ocr_service, 'process_pdf') as mock_ocr, \
             patch.object(mock_services.insights_service, 'generate_insights') as mock_insights:
            
            mock_ocr.return_value = "Extracted content"
            mock_insights.return_value = "Generated insights"
            
            response = client.post(
                "/api/process-pdf/",
                files={"pdf_file": ("test.pdf", file_content, "application/pdf")}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert "insights" in data
            assert data["filename"] == "test.pdf"


class TestTextExtractionEndpoint:
    """Test the text extraction (OCR-only) endpoint."""
    
    @pytest.fixture
    def mock_services(self):
        """Mock all services for testing."""
        with patch('main.get_app_state') as mock_state:
            mock_app_state = Mock()
            mock_app_state.config = Mock(max_file_size=10*1024*1024, save_extracted_content=False)
            mock_app_state.ocr_service = Mock()
            mock_app_state.file_service = Mock()
            mock_app_state.initialized = True

            mock_app_state.ocr_service.process_pdf.return_value = "Extracted markdown content"
            mock_app_state.file_service.save_extracted_content.return_value = None
            
            mock_state.return_value = mock_app_state
            yield mock_app_state
    
    def test_extract_text_invalid_content_type(self, mock_services):
        """Test text extraction with invalid content type."""
        client = TestClient(app)
        
        file_content = b"Not a PDF file"
        response = client.post(
            "/api/extract-text/",
            files={"pdf_file": ("test.txt", file_content, "text/plain")}
        )
        
        assert response.status_code == 400
        assert "Invalid file type" in response.json()["detail"]
    
    def test_extract_text_invalid_filename(self, mock_services):
        """Test text extraction with invalid filename."""
        client = TestClient(app)
        
        file_content = b"%PDF-1.4 content"
        response = client.post(
            "/api/extract-text/",
            files={"pdf_file": ("test.txt", file_content, "application/pdf")}
        )
        
        assert response.status_code == 400
        assert "Invalid filename" in response.json()["detail"]
    
    def test_extract_text_invalid_pdf_content(self, mock_services):
        """Test text extraction with invalid PDF content."""
        client = TestClient(app)
        
        file_content = b"Not PDF content"
        response = client.post(
            "/api/extract-text/",
            files={"pdf_file": ("test.pdf", file_content, "application/pdf")}
        )
        
        assert response.status_code == 400
        assert "does not appear to be a valid PDF" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_extract_text_success(self, mock_services):
        """Test successful text extraction."""
        client = TestClient(app)
        
        file_content = b"%PDF-1.4\nPDF content here"
        
        with patch.object(mock_services.ocr_service, 'process_pdf') as mock_ocr:
            mock_ocr.return_value = "# Extracted Text\n\nThis is the extracted content from the PDF."
            
            response = client.post(
                "/api/extract-text/",
                files={"pdf_file": ("research.pdf", file_content, "application/pdf")}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert "extracted_content" in data
            assert data["extracted_content"] == "# Extracted Text\n\nThis is the extracted content from the PDF."
            assert data["filename"] == "research.pdf"
            
            mock_ocr.assert_called_once()
    
    def test_extract_text_file_too_large(self, mock_services):
        """Test text extraction with file too large."""
        mock_services.config.max_file_size = 10
        
        client = TestClient(app)
        
        file_content = b"%PDF-1.4\nThis is a longer PDF content that exceeds the limit"
        response = client.post(
            "/api/extract-text/",
            files={"pdf_file": ("large.pdf", file_content, "application/pdf")}
        )
        
        assert response.status_code == 413
        assert "File too large" in response.json()["detail"]
