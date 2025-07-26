"""Utility functions for the InsightGUIDE API."""

import os
import re
import logging
from pathlib import Path
from typing import Dict

logger = logging.getLogger(__name__)


def setup_logging(log_level: str = "INFO") -> None:
    """Configure application logging."""
    
    logs_dir = Path("logs")
    logs_dir.mkdir(exist_ok=True)
    
    logging.basicConfig(
        level=getattr(logging, log_level.upper()),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler(logs_dir / "app.log", encoding='utf-8')
        ]
    )
    
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("openai").setLevel(logging.WARNING)
    
    logger.info(f"Logging configured with level: {log_level}")


def ensure_directory_exists(directory: str) -> Path:
    """Ensure a directory exists, create if it doesn't."""
    try:
        path = Path(directory)
        path.mkdir(parents=True, exist_ok=True)
        logger.debug(f"Ensured directory exists: {path}")
        return path
    except Exception as e:
        logger.error(f"Failed to create directory {directory}: {e}")
        raise OSError(f"Failed to create directory {directory}: {e}")


def safe_filename(filename: str) -> str:
    """Create a safe filename by removing/replacing unsafe characters."""
    if not filename:
        return "unnamed_file"
        
    safe_name = re.sub(r'[<>:"/\\|?*]', '_', filename)
    safe_name = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', safe_name)
    safe_name = safe_name.strip('. ')
    safe_name = safe_name[:255]
    
    if not safe_name:
        safe_name = "unnamed_file"
    return safe_name


def replace_images_in_markdown(markdown_str: str, images_dict: Dict[str, str]) -> str:
    """Replace image placeholders in markdown with base64-encoded images."""
    if not markdown_str:
        return ""
        
    for img_name, base64_str in images_dict.items():
        if img_name and base64_str:
            markdown_str = markdown_str.replace(
                f"![{img_name}]({img_name})", 
                f"![{img_name}](data:image/png;base64,{base64_str})"
            )
    return markdown_str


def validate_file_size(file_size: int, max_size: int) -> bool:
    """Validate file size against maximum allowed size."""
    if file_size < 0 or max_size < 0:
        return False
    return file_size <= max_size


def format_file_size(size_bytes: int) -> str:
    """Format file size in human readable format."""
    if size_bytes < 0:
        return "0 B"
        
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.1f} TB"


def fix_markdown_urls(markdown_content: str) -> str:
    """
    Fix markdown URLs that are missing protocol (http/https).
    
    Finds markdown links like [text](domain.com/path) and converts them to 
    [text](https://domain.com/path) to prevent relative URL issues in browsers.
    
    Args:
        markdown_content: The markdown content to process
        
    Returns:
        Markdown content with fixed URLs
    """
    import re
    
    if not markdown_content:
        return markdown_content
    
    link_pattern = r'\[([^\]]+)\]\(([^)]+)\)'
    
    def fix_url(match):
        text = match.group(1)
        url = match.group(2)
        
        if url.startswith(('http://', 'https://', 'ftp://', 'mailto:', '#', '/')):
            return match.group(0)
        
        domain_pattern = r'^[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}'
        
        if re.match(domain_pattern, url):
            fixed_url = f"https://{url}"
            logger.debug(f"Fixed URL: {url} -> {fixed_url}")
            return f"[{text}]({fixed_url})"
        
        return match.group(0)
    
    fixed_content = re.sub(link_pattern, fix_url, markdown_content)
    
    return fixed_content
