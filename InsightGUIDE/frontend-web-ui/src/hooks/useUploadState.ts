"use client";

import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
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
      setUrlError(null);
    }
    clearErrors();
  }, [resetField, clearErrors, uploadedFile]);

  const handleLoadFromUrl = useCallback(async () => {
    if (!pdfUrlInputValue || !pdfUrlInputValue.trim().startsWith('http')) {
      setUrlError("Please enter a valid PDF URL (starting with http or https).");
      return;
    }

    setIsUrlLoading(true);
    setUrlError(null);

    try {
      const response = await fetch(pdfUrlInputValue);
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}. Server might not allow direct fetching (CORS issue).`);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/pdf")) {
        throw new Error("The linked resource does not appear to be a PDF file (Content-Type mismatch).");
      }

      const blob = await response.blob();
      if (blob.size > MAX_FILE_SIZE) {
        throw new Error(`The PDF from URL exceeds the maximum file size of ${MAX_FILE_SIZE / (1024 * 1024)}MB.`);
      }

      const derivedFileName = extractFileNameFromUrl(pdfUrlInputValue);
      const file = new File([blob], derivedFileName, { type: "application/pdf" });

      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      setValue("pdfFile", dataTransfer.files, { shouldValidate: true });
      setPdfUrlInputValue("");
      onSuccess(derivedFileName);

    } catch (err: any) {
      console.error("Error loading PDF from URL:", err);
      setUrlError(err.message || "Could not load PDF from the provided URL. This might be a CORS issue if fetching from a different domain.");
      if (!(uploadedFile && uploadedFile.length > 0)) {
        setValue("pdfFile", null as any, { shouldValidate: true });
      }
    } finally {
      setIsUrlLoading(false);
    }
  }, [pdfUrlInputValue, extractFileNameFromUrl, setValue, uploadedFile, onSuccess]);

  const handleClearSelection = useCallback(() => {
    resetField("pdfFile");
    setPdfUrlInputValue("");
    setUrlError(null);
    setIsUrlMode(false);
    setIsPreloadMode(false);
    clearErrors();
  }, [resetField, clearErrors]);

  const handleSetPreloadedFile = useCallback((file: File) => {
    // Reset other modes and set the preloaded file
    setIsUrlMode(false);
    setPdfUrlInputValue("");
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
