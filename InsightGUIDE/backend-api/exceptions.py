class PDFInsightsError(Exception):
    """Base exception for InsightGUIDE API."""
    pass


class ConfigurationError(PDFInsightsError):
    """Raised when there's a configuration error."""
    pass


class FileProcessingError(PDFInsightsError):
    """Raised when file processing fails."""
    pass


class OCRProcessingError(FileProcessingError):
    """Raised when OCR processing fails."""
    pass


class AIInsightsError(PDFInsightsError):
    """Raised when AI insights generation fails."""
    pass
