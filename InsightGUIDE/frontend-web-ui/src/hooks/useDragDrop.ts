"use client";

import { useState, useCallback, useEffect } from 'react';

interface UseDragDropProps {
  isUrlMode: boolean;
  isPreloadMode?: boolean;
  isLoading: boolean;
  isUrlLoading: boolean;
  setValue: (name: string, value: any, options?: any) => void;
  onUrlModeToggle: (checked: boolean) => void;
  onError: (error: string) => void;
  maxFileSize: number;
  acceptedFileTypes: string[];
}

export function useDragDrop({
  isUrlMode,
  isPreloadMode = false,
  isLoading,
  isUrlLoading,
  setValue,
  onUrlModeToggle,
  onError,
  maxFileSize,
  acceptedFileTypes,
}: UseDragDropProps) {
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isUrlMode || isPreloadMode || isLoading || isUrlLoading) return;

    let containsFile = false;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        if (e.dataTransfer.items[i].kind === 'file') {
          containsFile = true;
          break;
        }
      }
    }
    if (containsFile) {
      setIsDraggingOver(true);
    }
  }, [isUrlMode, isLoading, isUrlLoading]);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    if (isLoading || isUrlLoading) return;

    if (isUrlMode) {
      onUrlModeToggle(false);
    }
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = e.dataTransfer.files;

      if (droppedFiles.length > 1) {
        onError("Please drop only one PDF file.");
        setValue("pdfFile", null, { shouldValidate: true });
        return;
      }

      const file = droppedFiles[0];
      
      if (!acceptedFileTypes.includes(file.type)) {
        onError("Invalid file type. Please drop a PDF file.");
        setValue("pdfFile", null, { shouldValidate: true });
        return;
      }
      
      if (file.size > maxFileSize) {
        onError(`File exceeds maximum size of ${maxFileSize / (1024 * 1024)}MB.`);
        setValue("pdfFile", null, { shouldValidate: true });
        return;
      }

      onError("");
      setValue("pdfFile", droppedFiles, { shouldValidate: true });
    }
  }, [isLoading, isUrlLoading, isUrlMode, isPreloadMode, onUrlModeToggle, setValue, onError, maxFileSize, acceptedFileTypes]);

  return {
    isDraggingOver,
    dragHandlers: {
      onDragEnter: handleDragEnter,
      onDragLeave: handleDragLeave,
      onDragOver: handleDragOver,
      onDrop: handleDrop,
    },
  };
}
