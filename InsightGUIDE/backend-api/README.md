# InsightGUIDE Backend REST API

A FastAPI backend service that processes scientific papers (PDFs) using AI-powered OCR and generates intelligent insights for research analysis. This system combines Mistral AI's advanced OCR capabilities with OpenAI API-compatible language models to provide comprehensive paper analysis.

## What This System Does

The InsightGUIDE API is designed to help researchers, academics, and students quickly understand and analyze scientific papers by:

1. **Smart PDF Processing**: Extracts text, images, and formatting from scientific papers using Mistral AI's OCR technology
2. **AI-Powered Analysis**: Generates comprehensive insights including:
   - Sectional analysis (Abstract, Methods, Results, Discussion)
   - Key contributions and novel findings
   - Critical evaluation and methodology assessment
   - Reading guidance and navigation tips
   - Identification of research gaps and future directions
3. **Structured Output**: Provides well-formatted markdown output that highlights important information
4. **Research Workflow Integration**: Saves extracted content for future reference and analysis

### Use Cases

- **Literature Review**: Quickly understand key papers in your field
- **Research Assessment**: Evaluate methodology and findings critically
- **Academic Writing**: Identify research gaps and contribution opportunities
- **Education**: Help students understand complex scientific papers
- **Research Management**: Process and organize large collections of papers

## Key Features

- **Advanced OCR Processing**: Handles complex scientific documents with tables, figures, and equations
- **AI-Powered Insights**: Uses configurable prompts optimized for different AI models
- **Production Ready**: Comprehensive error handling, logging, and monitoring
- **Scalable Architecture**: Async processing with proper dependency injection
- **Security First**: File validation, size limits, and secure processing
- **API Documentation**: Auto-generated OpenAPI documentation
- **Extensible Design**: Modular architecture for easy customization

## Tech Stack

- **Framework**: FastAPI 0.104+ with async support
- **AI Services**: 
  - Mistral AI (OCR processing with image extraction)
  - OpenAI/Compatible APIs (insight generation)
- **Configuration**: Pydantic v2 with validation
- **Logging**: Structured logging with configurable levels
- **Deployment**: Uvicorn/Gunicorn for production
- **Testing**: pytest with async support

## Prerequisites

- Python 3.11+
- Mistral AI API key (for OCR processing)
- OpenAI API key or compatible service (for insights generation)

## Installation & Setup

### 1. Clone and Setup Environment

```bash
cd backend-api

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Configure Environment Variables

Create a `.env` file based on `.env.example`:

```env
# Required API Keys
MISTRAL_API_KEY=your_mistral_api_key_here
OPENAI_API_KEY=your_openai_api_key_here

# AI Model Configuration
MODEL=gpt-4-turbo-preview

# API Configuration (optional)
OPENAI_API_HOST=https://api.openai.com/v1
FRONTEND_URL=http://localhost:9002

# System Configuration
SYSTEM_PROMPT_KEY=paper-assistant-prompt
MAX_FILE_SIZE=52428800
LOG_LEVEL=INFO

# Server Configuration
HOST=0.0.0.0
PORT=8000
```

### 3. Run the Application

#### Development Mode

```bash
# With auto-reload
python main.py

# Or using uvicorn directly
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

#### Production Mode

```bash
# Using the provided script (recommended)
./gunicorn_script.sh

# Or using Gunicorn directly
gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app \
  --bind $HOST:$PORT \
  --access-logfile ./logs/access.log \
  --error-logfile ./logs/error.log
```

**Note**: The `gunicorn_script.sh` automatically loads configuration from your `.env` file, including HOST and PORT settings. The script provides optimized production settings and proper logging configuration.

### Health Check

```bash
# Check if the API is running
./health_check.sh
```

The health check script also reads HOST and PORT from your `.env` file to check the correct endpoint.

## 📚 API Documentation

Once running, access the interactive documentation:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **Health Check**: http://localhost:8000/health

## 🔗 API Endpoints

### Health Check
```http
GET /health
```
Returns service health status and version.

### PDF Processing
```http
POST /api/process-pdf/
Content-Type: multipart/form-data

{
  "pdf_file": [PDF file]
}
```

Processes a PDF file to extract content and generate AI-powered insights.

#### Example Request
```bash
curl -X POST "http://localhost:8000/api/process-pdf/" \
  -H "Content-Type: multipart/form-data" \
  -F "pdf_file=@research_paper.pdf"
```

#### Example Response
```json
{
  "insights": "### Sectional Analysis & Synthesis\n\n**Abstract & Introduction**\nThis paper addresses the critical problem of...\n\n**Methods**\nThe authors employ a novel computational approach...",
  "filename": "research_paper.pdf"
}
```

### Text Extraction (OCR Only)
```http
POST /api/extract-text/
Content-Type: multipart/form-data

{
  "pdf_file": [PDF file]
}
```

Extracts text content from a PDF file using OCR without generating AI insights.

#### Example Request
```bash
curl -X POST "http://localhost:8000/api/extract-text/" \
  -H "Content-Type: multipart/form-data" \
  -F "pdf_file=@research_paper.pdf"
```

#### Example Response
```json
{
  "extracted_content": "# Research Paper Title\n\nThis is the extracted text content from the PDF document in markdown format...",
  "filename": "research_paper.pdf"
}
```

## Project Structure

```
backend-api/
├── main.py                # FastAPI application entry point
├── config.py              # Configuration management with Pydantic
├── services.py            # Business logic services (OCR, AI, File)
├── models.py              # Pydantic models for API schemas
├── exceptions.py          # Custom exception classes
├── utils.py               # Utility functions
├── requirements.txt       # Python dependencies
├── system_prompts.yaml    # AI prompt configurations
├── .env.example           # Environment variables template
├── tests/                 # Test suite
│   ├── conftest.py        # Test configuration
│   ├── test_config.py     # Configuration tests
│   └── test_main.py       # API endpoint tests
├── logs/                  # Application logs (created at runtime)
├── uploads/               # Temporary file uploads (created at runtime)
└── outputs/               # Extracted content storage (created at runtime)
```

## ⚙️ Configuration Options

| Variable | Default | Description |
|----------|---------|-------------|
| `MISTRAL_API_KEY` | Required | Mistral AI API key for OCR processing |
| `OPENAI_API_KEY` | Required | OpenAI API key for insights generation |
| `MODEL` | Required | AI model name (e.g., `gpt-4`, `deepseek-resoner`, `gpt-4-turbo-preview`) |
| `FRONTEND_URL` | `http://localhost:9002` | Frontend URL for CORS configuration |
| `OPENAI_API_HOST` | `https://api.openai.com/v1` | Custom OpenAI-compatible API endpoint |
| `SYSTEM_PROMPT_KEY` | `paper-assistant-prompt` | AI prompt template to use |
| `MAX_FILE_SIZE` | `52428800` (50MB) | Maximum PDF file size in bytes |
| `SAVE_EXTRACTED_CONTENT` | `false` | Whether to save OCR markdown output to files |
| `LOG_LEVEL` | `INFO` | Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL) |
| `HOST` | `0.0.0.0` | Server bind address |
| `PORT` | `8000` | Server port |

## AI Prompt Templates

The system uses configurable prompts in `system_prompts.yaml`:

- **`paper-assistant-prompt`**: Default prompt with structured output (the only one available for the demo)

Each template provides:

- **Sectional Analysis**: Abstract, Methods, Results, Discussion breakdown
- **Critical Evaluation**: Key contributions and methodological assessment  
- **Reader Guidance**: Navigation tips and attention signals
- **Research Context**: Field positioning and future directions
