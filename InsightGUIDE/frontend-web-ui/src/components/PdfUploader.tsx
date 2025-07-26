"use client";

import React from 'react';
import { useFormContext } from 'react-hook-form';
import type { FieldError } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { UploadCloud, AlertCircle, Loader2, Link as LinkIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
const ACCEPTED_FILE_TYPES = ["application/pdf"];

function getErrorMessage(error: any): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'Invalid file';
}

interface PdfUploaderProps {
  isLoading: boolean;
  isUrlLoading: boolean;
  isUrlMode: boolean;
  fileName: string | null;
  isDraggingOver: boolean;
  pdfUrlInputValue: string;
  urlError: string | null;
  onUrlModeToggle: (checked: boolean) => void;
  onPdfUrlInputChange: (value: string) => void;
  onLoadFromUrl: () => void;
  onClearSelection: () => void;
  onDragHandlers: {
    onDragEnter: (e: React.DragEvent<HTMLDivElement>) => void;
    onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
    onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
    onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  };
}

export function PdfUploader({
  isLoading,
  isUrlLoading,
  isUrlMode,
  fileName,
  isDraggingOver,
  pdfUrlInputValue,
  urlError,
  onUrlModeToggle,
  onPdfUrlInputChange,
  onLoadFromUrl,
  onClearSelection,
  onDragHandlers,
}: PdfUploaderProps) {
  const { register, formState: { errors: formErrors }, watch } = useFormContext();
  const uploadedFile = watch("pdfFile");
  const canAnalyze = uploadedFile && uploadedFile.length > 0 && !formErrors.pdfFile;

  const handleDropAreaClick = () => {
    if (!isUrlMode && !isLoading && !isUrlLoading && document.getElementById('pdfFile')) {
      (document.getElementById('pdfFile') as HTMLInputElement).click();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isUrlMode && !isLoading && !isUrlLoading && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      handleDropAreaClick();
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div
          className={cn(
            "group p-6 border-2 border-dashed rounded-lg text-center transition-colors duration-150 ease-in-out",
            isDraggingOver && !isUrlMode 
              ? "border-primary bg-primary/10 ring-2 ring-primary ring-offset-2 shadow-lg" 
              : "border-border hover:border-primary/70",
            isUrlMode 
              ? "bg-muted/50 cursor-not-allowed opacity-60" 
              : "cursor-pointer bg-card hover:bg-muted/30"
          )}
          {...onDragHandlers}
          onClick={handleDropAreaClick}
          role="button"
          tabIndex={isUrlMode || isLoading || isUrlLoading ? -1 : 0}
          onKeyDown={handleKeyDown}
          aria-label={
            isDraggingOver && !isUrlMode 
              ? "Drop PDF file here" 
              : fileName && !formErrors.pdfFile && !isUrlMode 
                ? `Selected file: ${fileName}` 
                : "Drag and drop a PDF file here, or click to select a file"
          }
        >
          <Input
            id="pdfFile"
            type="file"
            accept="application/pdf"
            className="hidden"
            {...register("pdfFile")}
            disabled={isLoading || isUrlLoading || isUrlMode}
          />
          
          {isDraggingOver && !isUrlMode ? (
            <div className="flex flex-col items-center justify-center pointer-events-none">
              <UploadCloud className="w-12 h-12 text-primary mb-2" />
              <p className="text-lg font-semibold text-primary">Drop PDF here</p>
              <p className="text-xs text-primary/80">to upload</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center pointer-events-none">
              <UploadCloud 
                className={cn(
                  "w-10 h-10 mb-2 transition-colors", 
                  isUrlMode 
                    ? "text-muted-foreground/50" 
                    : "text-muted-foreground group-hover:text-primary/70"
                )} 
              />
              <p className={cn("text-base font-medium", isUrlMode ? "text-muted-foreground/70" : "text-foreground")}>
                {fileName && !formErrors.pdfFile && !isUrlMode
                  ? <span className="text-primary font-semibold">{`Selected: ${fileName}`}</span>
                  : "Drag & drop PDF here, or click to select"}
              </p>
              <p className={cn("text-xs mt-1", isUrlMode ? "text-muted-foreground/60" : "text-muted-foreground")}>
                Max file size: {MAX_FILE_SIZE / (1024 * 1024)}MB
              </p>
            </div>
          )}
        </div>
        
        {formErrors.pdfFile && !isUrlMode && (
          <p className="text-xs sm:text-sm text-destructive mt-1 px-1">
            {getErrorMessage(formErrors.pdfFile)}
          </p>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="url-mode-switch"
          checked={isUrlMode}
          onCheckedChange={onUrlModeToggle}
          disabled={isLoading || isUrlLoading}
        />
        <Label 
          htmlFor="url-mode-switch" 
          className={cn(isLoading || isUrlLoading ? "cursor-not-allowed text-muted-foreground" : "")}
        >
          Load PDF from URL
        </Label>
      </div>

      {isUrlMode && (
        <div>
          <Label htmlFor="pdfUrlInput" className="text-base sm:text-lg font-medium">
            PDF URL
          </Label>
          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 mt-1">
            <Input
              id="pdfUrlInput"
              type="url"
              placeholder="https://example.com/document.pdf"
              value={pdfUrlInputValue}
              onChange={(e) => onPdfUrlInputChange(e.target.value)}
              className="flex-grow"
              disabled={isLoading || isUrlLoading}
            />
            <Button
              type="button"
              onClick={onLoadFromUrl}
              disabled={isLoading || isUrlLoading || !pdfUrlInputValue.trim()}
              className="w-full sm:w-auto"
            >
              {isUrlLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LinkIcon className="mr-2 h-4 w-4" />
              )}
              Load from URL
            </Button>
          </div>
          
          {fileName && !formErrors.pdfFile && isUrlMode && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Loaded: {fileName}
            </p>
          )}
          
          {urlError && (
            <Alert variant="destructive" className="mt-3">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>URL Error</AlertTitle>
              <AlertDescription>{urlError}</AlertDescription>
            </Alert>
          )}
          
          {formErrors.pdfFile && isUrlMode && (
            <p className="text-xs sm:text-sm text-destructive mt-1">
              {getErrorMessage(formErrors.pdfFile)}
            </p>
          )}
        </div>
      )}

      <div className="flex justify-end items-center space-x-3 mt-4">
        {canAnalyze && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onClearSelection} 
            disabled={isLoading || isUrlLoading} 
            type="button"
          >
            Clear Selection
          </Button>
        )}
        <Button
          type="submit"
          disabled={isLoading || isUrlLoading || !canAnalyze}
          className="bg-accent hover:bg-accent/90 text-accent-foreground px-6 py-3 text-base sm:text-lg"
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <UploadCloud className="mr-2 h-5 w-5" />
          )}
          Analyze PDF
        </Button>
      </div>
    </div>
  );
}
