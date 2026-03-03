"use client";

import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ACCEPTED_FILE_TYPES = ["application/pdf"];

const formSchema = z.object({
  pdfFile: z
    .custom<FileList>((v) => v === null || (v instanceof FileList && v.length > 0), {
      message: "PDF file is required for analysis.",
    })
    .refine((files) => !files || files.length === 0 || files?.[0]?.size <= MAX_FILE_SIZE, `Max file size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`)
    .refine(
      (files) => !files || files.length === 0 || ACCEPTED_FILE_TYPES.includes(files?.[0]?.type),
      "Only .pdf files are accepted."
    ).nullable(),
});

export type FormSchema = z.infer<typeof formSchema>;

interface UseUploadStateProps {
  onError: (error: string) => void;
  onSuccess: (fileName: string) => void;
  selectedPaper?: string | null;
}

export function useUploadState({ onError, onSuccess, selectedPaper }: UseUploadStateProps) {
  const [isUrlMode, setIsUrlMode] = useState<boolean>(false);
  const [isPreloadMode, setIsPreloadMode] = useState<boolean>(
    process.env.NEXT_PUBLIC_PRELOAD_DEFAULT_ON === 'true'
  );
  const [pdfUrlInputValue, setPdfUrlInputValue] = useState<string>("");
  const [isUrlLoading, setIsUrlLoading] = useState<boolean>(false);
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);
  const [selectedPdfUrlFileName, setSelectedPdfUrlFileName] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);

  const {
    register,
    handleSubmit,
    formState: { errors: formErrors },
    watch,
    setValue,
    resetField,
    clearErrors,
  } = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      pdfFile: null,
    }
  });

  const uploadedFile = watch("pdfFile");

  const extractFileNameFromUrl = useCallback((url: string): string => {
    try {
      const path = new URL(url).pathname;
      const parts = path.split('/');
      const lastPart = parts.pop() || "file.pdf";
      const sanitizedLastPart = lastPart.replace(/[^a-zA-Z0-9._-]/g, '_');
      return sanitizedLastPart.endsWith('.pdf') ? sanitizedLastPart : `${sanitizedLastPart.substring(0,50)}.pdf`;
    } catch (e) {
      const timestamp = new Date().getTime();
      return `downloaded_${timestamp}.pdf`;
    }
  }, []);

  const handleUrlModeToggle = useCallback((checked: boolean) => {
    // Don't allow any toggling if a file is already loaded (from any source)
    if (uploadedFile && uploadedFile.length > 0) {
      return; // Prevent any toggling when file is loaded - user must use "Clear Selection"
    }
    
    resetField("pdfFile");
    setIsUrlMode(checked);
    setPdfUrlInputValue("");
    setSelectedPdfUrl(null);
    setSelectedPdfUrlFileName(null);
    setUrlError(null);
    if (checked) {
      setIsDraggingOver(false);
    }
    clearErrors();
  }, [resetField, clearErrors, uploadedFile]);

  const handlePreloadModeToggle = useCallback((checked: boolean) => {
    // Don't allow any toggling if a file is already loaded (from any source)
    if (uploadedFile && uploadedFile.length > 0) {
      return; // Prevent any toggling when file is loaded - user must use "Clear Selection"
    }
    
    resetField("pdfFile");
    setIsPreloadMode(checked);
    if (checked) {
      setIsDraggingOver(false);
      setIsUrlMode(false); // Disable URL mode when preload is enabled
      setPdfUrlInputValue("");
      setSelectedPdfUrl(null);
      setSelectedPdfUrlFileName(null);
      setUrlError(null);
    }
    clearErrors();
  }, [resetField, clearErrors, uploadedFile]);

  const handleLoadFromUrl = useCallback(async () => {
    if (!pdfUrlInputValue || !pdfUrlInputValue.trim()) {
      setUrlError("Please enter a valid PDF URL.");
      return;
    }

    setIsUrlLoading(true);
    setUrlError(null);

    try {
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(pdfUrlInputValue.trim());
      } catch {
        throw new Error("Please enter a valid URL.");
      }

      if (parsedUrl.protocol !== "https:") {
        throw new Error("Please enter a valid HTTPS PDF URL.");
      }

      const normalizedUrl = parsedUrl.toString();
      const derivedFileName = extractFileNameFromUrl(normalizedUrl);

      resetField("pdfFile");
      setSelectedPdfUrl(normalizedUrl);
      setSelectedPdfUrlFileName(derivedFileName);
      setPdfUrlInputValue("");
      onSuccess(derivedFileName);

    } catch (err: unknown) {
      const message = err instanceof Error
        ? err.message
        : "Could not use the provided URL.";
      console.error("Error loading PDF from URL:", err);
      setSelectedPdfUrl(null);
      setSelectedPdfUrlFileName(null);
      setUrlError(message);
    } finally {
      setIsUrlLoading(false);
    }
  }, [pdfUrlInputValue, extractFileNameFromUrl, onSuccess, resetField]);

  const handleClearSelection = useCallback(() => {
    resetField("pdfFile");
    setPdfUrlInputValue("");
    setSelectedPdfUrl(null);
    setSelectedPdfUrlFileName(null);
    setUrlError(null);
    setIsUrlMode(false);
    setIsPreloadMode(false);
    clearErrors();
  }, [resetField, clearErrors]);

  const handleSetPreloadedFile = useCallback((file: File) => {
    // Reset other modes and set the preloaded file
    setIsUrlMode(false);
    setPdfUrlInputValue("");
    setSelectedPdfUrl(null);
    setSelectedPdfUrlFileName(null);
    setUrlError(null);
    clearErrors();

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    setValue("pdfFile", dataTransfer.files, { shouldValidate: true });
  }, [setValue, clearErrors]);

  return {
    // Form
    register,
    handleSubmit,
    formErrors,
    uploadedFile,
    setValue,
    clearErrors,
    
    // URL Mode
    isUrlMode,
    pdfUrlInputValue,
    setPdfUrlInputValue,
    isUrlLoading,
    selectedPdfUrl,
    selectedPdfUrlFileName,
    urlError,
    isDraggingOver,
    setIsDraggingOver,
    
    // Preload Mode
    isPreloadMode,
    
    // Computed properties
    isUrlModeDisabled: (uploadedFile && uploadedFile.length > 0) || isUrlLoading || !!selectedPaper || isPreloadMode,
    isPreloadModeDisabled: (uploadedFile && uploadedFile.length > 0) || isUrlLoading || isUrlMode,
    
    // Actions
    handleUrlModeToggle,
    handlePreloadModeToggle,
    handleLoadFromUrl,
    handleClearSelection,
    handleSetPreloadedFile,
    
    // Constants
    MAX_FILE_SIZE,
    ACCEPTED_FILE_TYPES,
  };
}
