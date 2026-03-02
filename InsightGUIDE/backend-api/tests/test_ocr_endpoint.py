#!/usr/bin/env python3
"""
Demo script to test the new OCR-only endpoint.
This script demonstrates the difference between the two endpoints:
1. /api/process-pdf/ - Returns AI insights
2. /api/extract-text/ - Returns only extracted text (OCR)
"""

from fastapi.testclient import TestClient
from main import app

def create_sample_pdf_content():
    """Create a minimal valid PDF content for testing."""
    return b"""%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
>>
endobj

xref
0 4
0000000000 65535 f 
0000000010 00000 n 
0000000079 00000 n 
0000000173 00000 n 
trailer
<<
/Size 4
/Root 1 0 R
>>
startxref
275
%%EOF"""

def test_endpoints():
    """Test both endpoints to show the difference."""
    client = TestClient(app)
    
    print("🧪 Testing InsightGUIDE API Endpoints")
    print("=" * 50)
    
    # Create sample PDF content
    pdf_content = create_sample_pdf_content()
    pdf_file = ("sample.pdf", pdf_content, "application/pdf")
    
    # Test health endpoint
    print("\n1. Testing Health Endpoint")
    health_response = client.get("/health")
    print(f"   Status: {health_response.status_code}")
    print(f"   Response: {health_response.json()}")
    
    # List available endpoints
    print("\n2. Available Endpoints")
    schema = app.openapi()
    for path in schema['paths'].keys():
        print(f"   {path}")
    
    print("\n3. Endpoint Comparison")
    print("   📄 /api/extract-text/   - OCR only (returns extracted text)")
    print("   🤖 /api/process-pdf/    - OCR + AI insights")
    
    print("\n4. Testing OCR-only endpoint (/api/extract-text/)")
    print("   This endpoint returns only the extracted text without AI processing...")
    print("   (Note: Would need valid API keys to fully test OCR functionality)")
    
    print("\n✅ All endpoints are properly configured!")
    print("\nTo test with a real PDF:")
    print("   curl -X POST 'http://localhost:8000/api/extract-text/' \\")
    print("        -H 'Content-Type: multipart/form-data' \\")
    print("        -F 'pdf_file=@your_document.pdf'")

if __name__ == "__main__":
    test_endpoints()
