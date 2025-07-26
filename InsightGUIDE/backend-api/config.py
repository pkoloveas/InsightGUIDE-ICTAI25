import os
import yaml
from pathlib import Path
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field, field_validator, ConfigDict
from dotenv import load_dotenv
import logging

logger = logging.getLogger(__name__)


class Config(BaseModel):
    """Application configuration model with validation."""
    
    model_config = ConfigDict(
        env_prefix="",
        case_sensitive=False,
        validate_assignment=True,
        extra="forbid"
    )
    
    mistral_api_key: str = Field(..., min_length=1)
    openai_api_key: str = Field(..., min_length=1)
    openai_api_host: Optional[str] = None
    model: str = Field(..., min_length=1)
    frontend_url: str = Field(default="http://localhost:9002")
    system_prompt_file: str = Field(default="system_prompts.yaml")
    system_prompt_key: str = Field(default="paper-assistant-prompt")
    system_prompt: str = Field(..., min_length=1)
    max_file_size: int = Field(default=50 * 1024 * 1024, gt=0)
    save_extracted_content: bool = Field(default=False)
    upload_dir: str = Field(default="uploads")
    output_dir: str = Field(default="outputs")
    port: int = Field(default=8000, ge=1, le=65535)
    host: str = Field(default="0.0.0.0")
    log_level: str = Field(default="INFO")

    @field_validator('log_level')
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        """Validate log level is one of the allowed values."""
        valid_levels = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']
        if v.upper() not in valid_levels:
            raise ValueError(f'log_level must be one of {valid_levels}')
        return v.upper()
    
    @field_validator('frontend_url')
    @classmethod
    def validate_frontend_url(cls, v: str) -> str:
        """Validate frontend URL format."""
        if not v.startswith(('http://', 'https://')):
            raise ValueError('frontend_url must start with http:// or https://')
        return v
    
    @field_validator('openai_api_host')
    @classmethod
    def validate_openai_api_host(cls, v: Optional[str]) -> Optional[str]:
        """Validate OpenAI API host format."""
        if v and not v.startswith(('http://', 'https://')):
            raise ValueError('openai_api_host must start with http:// or https://')
        return v


def load_system_prompt(prompt_file: str, prompt_key: str) -> str:
    """Load system prompt from YAML file."""
    try:
        prompt_path = Path(prompt_file)
        if not prompt_path.exists():
            raise FileNotFoundError(f"System prompt file {prompt_file} not found")
            
        with open(prompt_path, 'r', encoding='utf-8') as f:
            prompts_config = yaml.safe_load(f)
            
        if not prompts_config or "prompts" not in prompts_config:
            raise ValueError(f"Invalid prompt file structure in {prompt_file}")
            
        if prompt_key not in prompts_config["prompts"]:
            available_keys = list(prompts_config["prompts"].keys())
            raise ValueError(
                f"Prompt key '{prompt_key}' not found in {prompt_file}. "
                f"Available keys: {available_keys}"
            )
            
        content = prompts_config["prompts"][prompt_key].get("content", "")
        if not content:
            raise ValueError(f"Empty content for prompt key '{prompt_key}' in {prompt_file}")
            
        logger.info(f"Successfully loaded system prompt '{prompt_key}' from {prompt_file}")
        return content
        
    except yaml.YAMLError as e:
        raise ValueError(f"Error parsing YAML file {prompt_file}: {e}")


def load_config() -> Config:
    """Load and validate application configuration."""

    load_dotenv()
    
    def safe_int_parse(value: str, default: int) -> int:
        if not value:
            return default
        clean_value = value.split('#')[0].strip()
        try:
            return int(clean_value)
        except ValueError:
            logger.warning(f"Invalid integer value '{value}', using default {default}")
            return default
    
    config_data = {
        "mistral_api_key": os.getenv("MISTRAL_API_KEY"),
        "openai_api_key": os.getenv("OPENAI_API_KEY"),
        "openai_api_host": os.getenv("OPENAI_API_HOST"),
        "model": os.getenv("MODEL"),
        "frontend_url": os.getenv("FRONTEND_URL", "http://localhost:9002"),
        "system_prompt_file": os.getenv("SYSTEM_PROMPT_FILE", "system_prompts.yaml"),
        "system_prompt_key": os.getenv("SYSTEM_PROMPT_KEY", "paper-assistant-prompt"),
        "max_file_size": safe_int_parse(os.getenv("MAX_FILE_SIZE", ""), 50 * 1024 * 1024),
        "save_extracted_content": os.getenv("SAVE_EXTRACTED_CONTENT", "false").lower() in ("true", "1", "yes"),
        "upload_dir": os.getenv("UPLOAD_DIR", "uploads"),
        "output_dir": os.getenv("OUTPUT_DIR", "outputs"),
        "port": safe_int_parse(os.getenv("PORT", ""), 8000),
        "host": os.getenv("HOST", "0.0.0.0"),
        "log_level": os.getenv("LOG_LEVEL", "INFO"),
    }
    
    config_data = {k: v for k, v in config_data.items() if v is not None}
    
    try:
        system_prompt = load_system_prompt(
            config_data.get("system_prompt_file", "system_prompts.yaml"),
            config_data.get("system_prompt_key", "paper-assistant-prompt")
        )
        config_data["system_prompt"] = system_prompt
    except Exception as e:
        logger.error(f"Failed to load system prompt: {e}")
        raise ValueError(f"Failed to load system prompt: {e}")
    
    try:
        config = Config(**config_data)
        logger.info("Configuration loaded and validated successfully")
        return config
    except Exception as e:
        logger.error(f"Configuration validation failed: {e}")
        raise ValueError(f"Configuration validation failed: {e}")
