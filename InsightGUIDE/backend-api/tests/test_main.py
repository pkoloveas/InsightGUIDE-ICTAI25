"""Tests for the main API endpoints."""

import pytest
from unittest.mock import patch, Mock, AsyncMock
from fastapi.testclient import TestClient

from main import app, get_app_state


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
        mock_app_state = Mock()
        mock_app_state.config = Mock(max_file_size=10*1024*1024, save_extracted_content=False)
        mock_app_state.ocr_service = Mock()
        mock_app_state.insights_service = Mock()
        mock_app_state.file_service = Mock()
        mock_app_state.initialized = True

        mock_app_state.ocr_service.process_pdf = AsyncMock(return_value="Extracted content")
        mock_app_state.insights_service.generate_insights = AsyncMock(return_value="Generated insights")
        mock_app_state.file_service.save_extracted_content.return_value = None

        app.dependency_overrides[get_app_state] = lambda: mock_app_state
        try:
            yield mock_app_state
        finally:
            app.dependency_overrides.clear()
    
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

        response = client.post(
            "/api/process-pdf/",
            files={"pdf_file": ("test.pdf", file_content, "application/pdf")}
        )

        assert response.status_code == 200
        data = response.json()
        assert "insights" in data
        assert data["filename"] == "test.pdf"

    def test_process_pdf_success_with_url(self, mock_services):
        """Test successful PDF processing using URL input."""
        client = TestClient(app)

        with patch('main.download_pdf_from_url', new=AsyncMock(return_value=("arxiv-paper.pdf", b"%PDF-1.4\nurl content"))):
            response = client.post(
                "/api/process-pdf/",
                data={"pdf_url": "https://arxiv.org/pdf/2501.00001.pdf"}
            )

            assert response.status_code == 200
            data = response.json()
            assert data["filename"] == "arxiv-paper.pdf"
            assert "insights" in data

    def test_process_pdf_missing_input(self, mock_services):
        """Test PDF processing with missing input source."""
        client = TestClient(app)

        response = client.post("/api/process-pdf/")

        assert response.status_code == 400
        assert "either a PDF file or a PDF URL" in response.json()["detail"]

    def test_process_pdf_both_inputs(self, mock_services):
        """Test PDF processing with both file and URL provided."""
        client = TestClient(app)

        file_content = b"%PDF-1.4\nPDF content here"
        response = client.post(
            "/api/process-pdf/",
            data={"pdf_url": "https://arxiv.org/pdf/2501.00001.pdf"},
            files={"pdf_file": ("test.pdf", file_content, "application/pdf")}
        )

        assert response.status_code == 400
        assert "either pdf_file or pdf_url" in response.json()["detail"]


class TestTextExtractionEndpoint:
    """Test the text extraction (OCR-only) endpoint."""
    
    @pytest.fixture
    def mock_services(self):
        """Mock all services for testing."""
        mock_app_state = Mock()
        mock_app_state.config = Mock(max_file_size=10*1024*1024, save_extracted_content=False)
        mock_app_state.ocr_service = Mock()
        mock_app_state.file_service = Mock()
        mock_app_state.initialized = True

        mock_app_state.ocr_service.process_pdf = AsyncMock(return_value="Extracted markdown content")
        mock_app_state.file_service.save_extracted_content.return_value = None

        app.dependency_overrides[get_app_state] = lambda: mock_app_state
        try:
            yield mock_app_state
        finally:
            app.dependency_overrides.clear()
    
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

        mock_services.ocr_service.process_pdf = AsyncMock(
            return_value="# Extracted Text\n\nThis is the extracted content from the PDF."
        )

        response = client.post(
            "/api/extract-text/",
            files={"pdf_file": ("research.pdf", file_content, "application/pdf")}
        )

        assert response.status_code == 200
        data = response.json()
        assert "extracted_content" in data
        assert data["extracted_content"] == "# Extracted Text\n\nThis is the extracted content from the PDF."
        assert data["filename"] == "research.pdf"

        # Verify OCR service was called but insights service was not
        mock_services.ocr_service.process_pdf.assert_called_once()

    def test_extract_text_success_with_url(self, mock_services):
        """Test successful text extraction using URL input."""
        client = TestClient(app)

        with patch('main.download_pdf_from_url', new=AsyncMock(return_value=("research-paper.pdf", b"%PDF-1.4\nurl content"))):
            response = client.post(
                "/api/extract-text/",
                data={"pdf_url": "https://example.org/research-paper.pdf"}
            )

            assert response.status_code == 200
            data = response.json()
            assert data["filename"] == "research-paper.pdf"
            assert "extracted_content" in data
    
    def test_extract_text_file_too_large(self, mock_services):
        """Test text extraction with file too large."""
        # Set a very small max file size for testing
        mock_services.config.max_file_size = 10
        
        client = TestClient(app)
        
        file_content = b"%PDF-1.4\nThis is a longer PDF content that exceeds the limit"
        response = client.post(
            "/api/extract-text/",
            files={"pdf_file": ("large.pdf", file_content, "application/pdf")}
        )
        
        assert response.status_code == 413
        assert "File too large" in response.json()["detail"]


class TestPDFURLProcessingEndpoint:
    """Test the URL-only PDF processing endpoint."""

    @pytest.fixture
    def mock_services(self):
        """Mock all services for testing."""
        mock_app_state = Mock()
        mock_app_state.config = Mock(max_file_size=10*1024*1024, save_extracted_content=False)
        mock_app_state.ocr_service = Mock()
        mock_app_state.insights_service = Mock()
        mock_app_state.file_service = Mock()
        mock_app_state.initialized = True

        mock_app_state.ocr_service.process_pdf = AsyncMock(return_value="Extracted content")
        mock_app_state.insights_service.generate_insights = AsyncMock(return_value="Generated insights")
        mock_app_state.file_service.save_extracted_content.return_value = None

        app.dependency_overrides[get_app_state] = lambda: mock_app_state
        try:
            yield mock_app_state
        finally:
            app.dependency_overrides.clear()

    def test_process_pdf_url_success(self, mock_services):
        """Test successful URL-based PDF processing via JSON endpoint."""
        client = TestClient(app)

        with patch('main.download_pdf_from_url', new=AsyncMock(return_value=("arxiv-paper.pdf", b"%PDF-1.4\nurl content"))):
            response = client.post(
                "/api/process-pdf-url/",
                json={"pdf_url": "https://arxiv.org/pdf/2501.00001.pdf"}
            )

            assert response.status_code == 200
            data = response.json()
            assert data["filename"] == "arxiv-paper.pdf"
            assert "insights" in data

    def test_process_pdf_url_missing_payload_field(self, mock_services):
        """Test URL endpoint with missing pdf_url field."""
        client = TestClient(app)

        response = client.post(
            "/api/process-pdf-url/",
            json={}
        )

        assert response.status_code == 422

    def test_process_pdf_url_invalid_scheme(self, mock_services):
        """Test URL endpoint with unsupported URL scheme."""
        client = TestClient(app)

        response = client.post(
            "/api/process-pdf-url/",
            json={"pdf_url": "ftp://example.com/paper.pdf"}
        )

        assert response.status_code == 400
        assert "valid HTTPS URL" in response.json()["detail"]

    def test_process_pdf_url_rejects_restricted_address(self, mock_services):
        """Test URL endpoint rejects private/restricted network targets."""
        client = TestClient(app)

        response = client.post(
            "/api/process-pdf-url/",
            json={"pdf_url": "https://127.0.0.1/paper.pdf"}
        )

        assert response.status_code == 400
        assert "restricted network address" in response.json()["detail"]


class TestOCRURLProcessingEndpoint:
    """Test the URL-only OCR endpoint."""

    @pytest.fixture
    def mock_services(self):
        """Mock OCR services for testing."""
        mock_app_state = Mock()
        mock_app_state.config = Mock(max_file_size=10*1024*1024, save_extracted_content=False)
        mock_app_state.ocr_service = Mock()
        mock_app_state.file_service = Mock()
        mock_app_state.initialized = True

        mock_app_state.ocr_service.process_pdf = AsyncMock(return_value="# Extracted from URL")
        mock_app_state.file_service.save_extracted_content.return_value = None

        app.dependency_overrides[get_app_state] = lambda: mock_app_state
        try:
            yield mock_app_state
        finally:
            app.dependency_overrides.clear()

    def test_extract_text_url_success(self, mock_services):
        """Test successful OCR extraction from URL via JSON endpoint."""
        client = TestClient(app)

        with patch('main.download_pdf_from_url', new=AsyncMock(return_value=("paper.pdf", b"%PDF-1.4\nurl content"))):
            response = client.post(
                "/api/extract-text-url/",
                json={"pdf_url": "https://example.org/paper.pdf"}
            )

            assert response.status_code == 200
            data = response.json()
            assert data["filename"] == "paper.pdf"
            assert data["extracted_content"] == "# Extracted from URL"

    def test_extract_text_url_missing_payload_field(self, mock_services):
        """Test OCR URL endpoint with missing pdf_url field."""
        client = TestClient(app)

        response = client.post(
            "/api/extract-text-url/",
            json={}
        )

        assert response.status_code == 422

    def test_extract_text_url_invalid_scheme(self, mock_services):
        """Test OCR URL endpoint with unsupported URL scheme."""
        client = TestClient(app)

        response = client.post(
            "/api/extract-text-url/",
            json={"pdf_url": "ftp://example.com/paper.pdf"}
        )

        assert response.status_code == 400
        assert "valid HTTPS URL" in response.json()["detail"]

    def test_extract_text_url_rejects_restricted_address(self, mock_services):
        """Test OCR URL endpoint rejects private/restricted network targets."""
        client = TestClient(app)

        response = client.post(
            "/api/extract-text-url/",
            json={"pdf_url": "https://127.0.0.1/paper.pdf"}
        )

        assert response.status_code == 400
        assert "restricted network address" in response.json()["detail"]
