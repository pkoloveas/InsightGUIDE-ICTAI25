"""Tests for configuration management."""

import os
import pytest
import tempfile
from unittest.mock import patch, mock_open

from config import load_config, load_system_prompt, Config
from exceptions import ConfigurationError


class TestConfig:
    """Test configuration loading and validation."""
    
    def test_config_validation_success(self):
        """Test successful config validation."""
        config_data = {
            "mistral_api_key": "test_key",
            "openai_api_key": "test_key", 
            "model": "gpt-3.5-turbo",
            "system_prompt": "Test prompt"
        }
        config = Config(**config_data)
        assert config.mistral_api_key == "test_key"
        assert config.model == "gpt-3.5-turbo"
    
    def test_config_validation_missing_required(self):
        """Test config validation with missing required fields."""
        with pytest.raises(ValueError):
            Config(mistral_api_key="", openai_api_key="test", model="test")
    
    def test_log_level_validation(self):
        """Test log level validation."""
        config_data = {
            "mistral_api_key": "test",
            "openai_api_key": "test",
            "model": "test",
            "system_prompt": "test",
            "log_level": "INVALID"
        }
        with pytest.raises(ValueError):
            Config(**config_data)


class TestSystemPromptLoading:
    """Test system prompt loading functionality."""
    
    def test_load_system_prompt_success(self):
        """Test successful system prompt loading."""
        yaml_content = """
prompts:
  test-prompt:
    content: "This is a test prompt"
"""
        with patch("builtins.open", mock_open(read_data=yaml_content)):
            result = load_system_prompt("test.yaml", "test-prompt")
            assert result == "This is a test prompt"
    
    def test_load_system_prompt_missing_key(self):
        """Test system prompt loading with missing key."""
        yaml_content = """
prompts:
  other-prompt:
    content: "Other prompt"
"""
        with patch("builtins.open", mock_open(read_data=yaml_content)):
            with pytest.raises(ValueError, match="Prompt key 'missing-key' not found"):
                load_system_prompt("test.yaml", "missing-key")
    
    def test_load_system_prompt_file_not_found(self):
        """Test system prompt loading with missing file."""
        with pytest.raises(ValueError, match="System prompt file missing.yaml not found"):
            load_system_prompt("missing.yaml", "test-prompt")
