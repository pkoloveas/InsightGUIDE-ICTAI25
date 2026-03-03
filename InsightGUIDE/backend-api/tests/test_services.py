"""Tests for backend services."""

import asyncio
from unittest.mock import Mock

import pytest

from exceptions import OCRProcessingError
from services import OCRService


def test_ocr_service_rejects_empty_pdf_bytes():
    """OCR service should reject empty payloads before calling external clients."""
    service = OCRService(Mock())

    with pytest.raises(OCRProcessingError, match="Empty PDF bytes provided"):
        asyncio.run(service.process_pdf("empty.pdf", b""))


def test_ocr_service_processes_pdf_and_cleans_up_uploaded_file():
    """OCR service should process markdown and always delete temporary Mistral files."""
    mistral_client = Mock()
    mistral_client.files.upload.return_value = Mock(id="file_123")
    mistral_client.files.get_signed_url.return_value = Mock(url="https://example.com/signed-url")

    page = Mock()
    page.markdown = "# Extracted content"
    page.images = []
    mistral_client.ocr.process.return_value = Mock(pages=[page])

    service = OCRService(mistral_client)

    result = asyncio.run(service.process_pdf("paper.pdf", b"%PDF-1.4\ncontent"))

    assert "# Extracted content" in result
    mistral_client.files.upload.assert_called_once()
    mistral_client.files.get_signed_url.assert_called_once_with(file_id="file_123", expiry=1)
    mistral_client.ocr.process.assert_called_once()
    mistral_client.files.delete.assert_called_once_with(file_id="file_123")


def test_ocr_service_still_cleans_up_when_ocr_fails():
    """Cleanup should happen even when OCR processing fails."""
    mistral_client = Mock()
    mistral_client.files.upload.return_value = Mock(id="file_456")
    mistral_client.files.get_signed_url.return_value = Mock(url="https://example.com/signed-url")
    mistral_client.ocr.process.side_effect = RuntimeError("OCR provider failure")

    service = OCRService(mistral_client)

    with pytest.raises(OCRProcessingError, match="Failed to process PDF with OCR"):
        asyncio.run(service.process_pdf("paper.pdf", b"%PDF-1.4\ncontent"))

    mistral_client.files.delete.assert_called_once_with(file_id="file_456")
