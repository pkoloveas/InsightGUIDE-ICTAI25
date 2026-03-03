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

  const getBackendBaseUrl = useCallback((): string | null => {
    const baseUrl = process.env.NEXT_PUBLIC_BACKEND_BASE_URL;
    if (!baseUrl) {
      return null;
    }

    return baseUrl.replace(/\/+$/, "");
  }, []);

  const normalizeErrorMessage = useCallback((errorMessage: string): string => {
    if (errorMessage.toLowerCase().includes('exceeds the model\'s max input limit') ||
        errorMessage.toLowerCase().includes('context length') || 
        errorMessage.toLowerCase().includes('token limit') ||
        errorMessage.toLowerCase().includes('too long') ||
        errorMessage.toLowerCase().includes('maximum length') ||
        errorMessage.toLowerCase().includes('invalid_request_error')) {
      return "This PDF exceeds the context length limit and is too large to process. Please try uploading a smaller PDF document with fewer pages or less text content.";
    }
    
    if (errorMessage.toLowerCase().includes('timeout') ||
        errorMessage.toLowerCase().includes('timed out')) {
      return "The PDF processing timed out. This usually happens with very large files. Please try a smaller PDF document.";
    }
    
    if (errorMessage.toLowerCase().includes('format') ||
        errorMessage.toLowerCase().includes('invalid') ||
        errorMessage.toLowerCase().includes('corrupted')) {
      return "Unable to process this PDF file. The file may be corrupted, password-protected, or in an unsupported format. Please try a different PDF.";
    }

    return errorMessage;
  }, []);

  const readInsightsResponse = useCallback(async (response: Response): Promise<string> => {
    const contentType = response.headers.get("content-type");

    if (contentType && contentType.includes("application/json")) {
      const jsonData = await response.json() as Partial<InsightResponse>;
      if (jsonData && typeof jsonData.insights === 'string') {
        return jsonData.insights;
      }

      throw new Error("Invalid JSON response: 'insights' field missing or not a string.");
    }

    const textData = await response.text();
    if (!textData) {
      throw new Error("Empty response from API.");
    }

    return textData;
  }, []);

  const processApiRequest = useCallback(async (endpoint: string, init: RequestInit) => {
    const backendBaseUrl = getBackendBaseUrl();

    if (!backendBaseUrl) {
      onError("Backend API URL is not configured. Please set NEXT_PUBLIC_BACKEND_BASE_URL in your .env.local file.");
      return;
    }

    try {
      const response = await fetch(`${backendBaseUrl}${endpoint}`, init);

      if (!response.ok) {
        let errorMsg = `API Error: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json() as Record<string, string>;
          errorMsg = errorData.detail || errorData.message || errorData.error || errorMsg;
        } catch {
          // Ignore if error response is not JSON
        }
        throw new Error(errorMsg);
      }

      const insightsText = await readInsightsResponse(response);
      setInsights(insightsText);
      onSuccess(insightsText);

    } catch (err: unknown) {
      const rawError = err instanceof Error ? err.message : "An unknown error occurred during PDF processing.";
      const normalizedError = normalizeErrorMessage(rawError);
      onError(normalizedError);
      console.error("PDF processing error:", err);
    }
  }, [getBackendBaseUrl, normalizeErrorMessage, onError, onSuccess, readInsightsResponse]);

  const submitPdf = useCallback(async (file: File) => {
    setIsLoading(true);
    
    const formData = new FormData();
    formData.append("pdf_file", file);

    try {
      await processApiRequest("/api/process-pdf/", {
        method: "POST",
        body: formData,
      });
    } finally {
      setIsLoading(false);
    }
  }, [processApiRequest]);

  const submitPdfUrl = useCallback(async (pdfUrl: string) => {
    setIsLoading(true);

    try {
      await processApiRequest("/api/process-pdf-url/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pdf_url: pdfUrl }),
      });
    } finally {
      setIsLoading(false);
    }
  }, [processApiRequest]);

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
    submitPdfUrl,
    clearInsights,
    setTestInsights,
  };
}
