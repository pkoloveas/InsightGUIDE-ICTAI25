"use client";

import { useState, useCallback } from 'react';

interface InsightResponse {
  insights: string;
}

interface UseApiStateProps {
  onError: (error: string) => void;
  onSuccess: (insights: string) => void;
}

export function useApiState({ onError, onSuccess }: UseApiStateProps) {
  const [insights, setInsights] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const submitPdf = useCallback(async (file: File) => {
    setIsLoading(true);
    
    const formData = new FormData();
    formData.append("pdf_file", file);

    const backendApiUrl = process.env.NEXT_PUBLIC_BACKEND_BASE_URL 
      ? `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/api/process-pdf/` 
      : null;

    if (!backendApiUrl) {
      onError("Backend API URL is not configured. Please set NEXT_PUBLIC_BACKEND_BASE_URL in your .env.local file.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(backendApiUrl, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let errorMsg = `API Error: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.detail || errorData.message || errorData.error || errorMsg;
        } catch (e) { 
          // Ignore if error response is not json
        }
        throw new Error(errorMsg);
      }

      const contentType = response.headers.get("content-type");
      let insightsText: string;

      if (contentType && contentType.includes("application/json")) {
        const jsonData = await response.json() as Partial<InsightResponse>;
        if (jsonData && typeof jsonData.insights === 'string') {
          insightsText = jsonData.insights;
        } else {
          throw new Error("Invalid JSON response: 'insights' field missing or not a string.");
        }
      } else {
        const textData = await response.text();
        if (textData) {
          insightsText = textData;
        } else {
          throw new Error("Empty response from API.");
        }
      }

      setInsights(insightsText);
      onSuccess(insightsText);

    } catch (err: any) {
      let errorMessage = err.message || "An unknown error occurred during PDF processing.";
      
      if (errorMessage.toLowerCase().includes('exceeds the model\'s max input limit') ||
          errorMessage.toLowerCase().includes('context length') || 
          errorMessage.toLowerCase().includes('token limit') ||
          errorMessage.toLowerCase().includes('too long') ||
          errorMessage.toLowerCase().includes('maximum length') ||
          errorMessage.toLowerCase().includes('invalid_request_error')) {
        errorMessage = "This PDF exceeds the context length limit and is too large to process. Please try uploading a smaller PDF document with fewer pages or less text content.";
      }
      
      else if (errorMessage.toLowerCase().includes('timeout') ||
               errorMessage.toLowerCase().includes('timed out')) {
        errorMessage = "The PDF processing timed out. This usually happens with very large files. Please try a smaller PDF document.";
      }
      
      else if (errorMessage.toLowerCase().includes('format') ||
               errorMessage.toLowerCase().includes('invalid') ||
               errorMessage.toLowerCase().includes('corrupted')) {
        errorMessage = "Unable to process this PDF file. The file may be corrupted, password-protected, or in an unsupported format. Please try a different PDF.";
      }
      
      onError(errorMessage);
      console.error("Upload error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [onError, onSuccess]);

  const clearInsights = useCallback(() => {
    setInsights(null);
  }, []);

  const setTestInsights = useCallback((testContent: string) => {
    setInsights(testContent);
    onSuccess(testContent);
  }, [onSuccess]);

  return {
    insights,
    isLoading,
    submitPdf,
    clearInsights,
    setTestInsights,
  };
}
