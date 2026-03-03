# InsightGUIDE API Reference

Base URL: `http://localhost:8000`

Interactive docs:

- Swagger UI: `GET /docs`
- ReDoc: `GET /redoc`

## Authentication

No authentication is currently required.

## Common Behavior

- All PDF-processing endpoints validate file size against `MAX_FILE_SIZE` (default: `50MB`).
- PDF content is validated by checking the `%PDF-` signature.
- URL-based inputs must be `https`.
- URL downloads follow redirects and enforce size limits during streaming.

## Error Response Shape

```json
{
  "detail": "Human-readable message",
  "error_type": "ValidationError"
}
```

Common status codes:

- `200`: Success
- `400`: Validation or request error
- `413`: Input exceeds configured max size
- `422`: Request body/field schema validation error
- `500`: Unexpected internal server error

---

## 1) Health

### `GET /health`

Returns API health and version.

Response (`200`):

```json
{
  "status": "healthy",
  "version": "1.0.0"
}
```

---

## 2) Process PDF (multipart)

### `POST /api/process-pdf/`

Processes a PDF and returns AI insights.

Content-Type: `multipart/form-data`

Input (provide exactly one):

- `pdf_file`: uploaded PDF file
- `pdf_url`: public URL to a PDF file

cURL (file):

```bash
curl -X POST "http://localhost:8000/api/process-pdf/" \
  -H "Content-Type: multipart/form-data" \
  -F "pdf_file=@research_paper.pdf"
```

cURL (url):

```bash
curl -X POST "http://localhost:8000/api/process-pdf/" \
  -H "Content-Type: multipart/form-data" \
  -F "pdf_url=https://arxiv.org/pdf/2501.00001.pdf"
```

Response (`200`):

```json
{
  "insights": "### Sectional Analysis...",
  "filename": "research_paper.pdf"
}
```

Validation errors (`400`):

- `Provide either pdf_file or pdf_url, not both`
- `Please provide either a PDF file or a PDF URL`
- `Invalid file type. Please upload a PDF file.`
- `Invalid filename. Please ensure the file has a .pdf extension.`
- `Invalid PDF URL. Please provide a valid HTTPS URL.`
- `URL does not point to a PDF file`
- `File does not appear to be a valid PDF`
- `Failed to download PDF from URL`

Size limit (`413`):

- `File too large. Maximum size: ...`

---

## 3) Process PDF from URL (JSON)

### `POST /api/process-pdf-url/`

Processes a PDF URL and returns AI insights.

Content-Type: `application/json`

Request:

```json
{
  "pdf_url": "https://arxiv.org/pdf/2501.00001.pdf"
}
```

cURL:

```bash
curl -X POST "http://localhost:8000/api/process-pdf-url/" \
  -H "Content-Type: application/json" \
  -d '{"pdf_url":"https://arxiv.org/pdf/2501.00001.pdf"}'
```

Response (`200`):

```json
{
  "insights": "### Sectional Analysis...",
  "filename": "2501.00001.pdf"
}
```

Validation errors:

- `422` for missing/invalid JSON payload fields.
- `400` for invalid/unreachable/non-PDF URLs.

---

## 4) Extract Text (multipart)

### `POST /api/extract-text/`

Extracts OCR markdown from a PDF without generating AI insights.

Content-Type: `multipart/form-data`

Input (provide exactly one):

- `pdf_file`: uploaded PDF file
- `pdf_url`: public URL to a PDF file

cURL (file):

```bash
curl -X POST "http://localhost:8000/api/extract-text/" \
  -H "Content-Type: multipart/form-data" \
  -F "pdf_file=@research_paper.pdf"
```

cURL (url):

```bash
curl -X POST "http://localhost:8000/api/extract-text/" \
  -H "Content-Type: multipart/form-data" \
  -F "pdf_url=https://arxiv.org/pdf/2501.00001.pdf"
```

Response (`200`):

```json
{
  "extracted_content": "# Paper title\\n\\n...",
  "filename": "research_paper.pdf"
}
```

Validation/status behavior mirrors `/api/process-pdf/` for input and URL checks.

---

## 5) Extract Text from URL (JSON)

### `POST /api/extract-text-url/`

Extracts OCR markdown from a PDF URL.

Content-Type: `application/json`

Request:

```json
{
  "pdf_url": "https://arxiv.org/pdf/2501.00001.pdf"
}
```

cURL:

```bash
curl -X POST "http://localhost:8000/api/extract-text-url/" \
  -H "Content-Type: application/json" \
  -d '{"pdf_url":"https://arxiv.org/pdf/2501.00001.pdf"}'
```

Response (`200`):

```json
{
  "extracted_content": "# Paper title\\n\\n...",
  "filename": "2501.00001.pdf"
}
```

Validation errors:

- `422` for missing/invalid JSON payload fields.
- `400` for invalid/unreachable/non-PDF URLs.

---

## Notes for Clients

- Prefer JSON endpoints (`/api/process-pdf-url/`, `/api/extract-text-url/`) for standalone URL-only integrations.
- Prefer multipart endpoints when clients may send either direct file uploads or URLs.
- For very large PDFs, increase `MAX_FILE_SIZE` in environment configuration.
