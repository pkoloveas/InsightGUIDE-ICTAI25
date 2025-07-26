"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Document, Page, pdfjs } from "react-pdf";
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { UploadCloud, FileText, AlertCircle, Loader2, ChevronLeft, ChevronRight, ServerCrash, Link as LinkIcon, ZoomIn, ZoomOut, RefreshCw, Expand, Minimize } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

// Components
import { InsightsViewer } from "@/components/InsightsViewer";
import { PreloadSelector } from "@/components/PreloadSelector";

// Hooks
import { useUploadState } from "@/hooks/useUploadState";
import { useApiState } from "@/hooks/useApiState";
import { useUIState } from "@/hooks/useUIState";
import { usePdfState } from "@/hooks/usePdfState";
import { useDragDrop } from "@/hooks/useDragDrop";
import { usePreloadState } from "@/hooks/usePreloadState";

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const formSchema = z.object({
  pdfFile: z
    .custom<FileList>((v: any) => v === null || (v instanceof FileList && v.length > 0), {
      message: "PDF file is required for analysis.",
    })
    .refine((files: any) => !files || files.length === 0 || files?.[0]?.size <= 15 * 1024 * 1024, `Max file size is 15MB.`)
    .refine(
      (files: any) => !files || files.length === 0 || ["application/pdf"].includes(files?.[0]?.type),
      "Only .pdf files are accepted."
    ).nullable(),
});

type FormSchema = z.infer<typeof formSchema>;

interface InsightResponse {
  insights: string;
}


export default function InsightGUIDEPage() {
  const isTestingEnabled = process.env.NEXT_PUBLIC_ENABLE_TESTING === 'true';
  const isPreloadEnabled = process.env.NEXT_PUBLIC_ENABLE_PRELOAD === 'true';

  const {
    error: uiError,
    setError: setUIError,
    clearError: clearUIError,
    maximizedCard,
    toggleMaximizeCard
  } = useUIState();

  const preloadState = isPreloadEnabled ? usePreloadState({
    onError: setUIError,
    onSuccess: (fileName: string, insights: string) => {
      updatePdfState({ fileName });
      setTestInsights(insights);
      scrollToDualPanes();
    }
  }) : {
    preloadedPapers: [],
    selectedPaper: null,
    isPreloadLoading: false,
    loadPreloadedPaper: async () => null,
    clearPreloadedPaper: () => {},
  };

  const {
    preloadedPapers,
    selectedPaper,
    isPreloadLoading,
    loadPreloadedPaper,
    clearPreloadedPaper,
  } = preloadState;

  const {
    register,
    handleSubmit,
    formErrors,
    uploadedFile,
    setValue,
    clearErrors,
    isUrlMode,
    pdfUrlInputValue,
    setPdfUrlInputValue,
    isUrlLoading,
    urlError,
    isDraggingOver,
    setIsDraggingOver,
    isPreloadMode,
    isUrlModeDisabled,
    isPreloadModeDisabled,
    handleUrlModeToggle,
    handlePreloadModeToggle,
    handleLoadFromUrl,
    handleClearSelection,
    handleSetPreloadedFile,
    MAX_FILE_SIZE,
    ACCEPTED_FILE_TYPES
  } = useUploadState({
    onError: setUIError,
    onSuccess: (fileName: string) => {
      updatePdfState({ fileName });
    },
    selectedPaper: isPreloadEnabled ? selectedPaper : null
  });

  const {
    insights,
    isLoading,
    submitPdf,
    clearInsights,
    setTestInsights,
  } = useApiState({
    onError: setUIError,
    onSuccess: () => {
      clearUIError();
      scrollToDualPanes();
    }
  });

  const {
    pdfState,
    pdfDisplayRef,
    scrollAreaRef,
    updatePdfState,
    clearPdfState,
    resetPdfViewState,
    forceResetPdfView,
    smoothResetPdfView,
    onDocumentLoadSuccess,
    pageControls,
    zoomControls
  } = usePdfState({
    onError: setUIError,
    clearErrors: clearUIError,
    maximizedCard
  });

  const {
    dragHandlers
  } = useDragDrop({
    isUrlMode,
    isLoading,
    isUrlLoading,
    setValue: (name: string, value: any, options?: any) => setValue("pdfFile" as any, value, options),
    onUrlModeToggle: handleUrlModeToggle,
    onError: setUIError,
    maxFileSize: MAX_FILE_SIZE,
    acceptedFileTypes: ACCEPTED_FILE_TYPES
  });

  const error = uiError;
  const fileName = pdfState.fileName;

  const dualPanesRef = useRef<HTMLDivElement>(null);

  const scrollToDualPanes = useCallback(() => {
    if (dualPanesRef.current) {
      const delay = pdfState.pdfUrl ? 1000 : 300;
      
      setTimeout(() => {
        const yOffset = -20;
        const element = dualPanesRef.current;
        if (element) {
          const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
          window.scrollTo({ 
            top: y, 
            behavior: 'smooth' 
          });
        }
      }, delay);
    }
  }, [pdfState.pdfUrl]);

  const handlePdfMaximizeToggle = useCallback(() => {
    const wasMaximized = maximizedCard === 'pdf';
    
    const currentScrollY = window.scrollY;
    
    toggleMaximizeCard('pdf');
    
    if (wasMaximized && pdfState.pdfUrl) {
      const scrollY1 = window.scrollY;
      
      setTimeout(() => {
        const scrollY2 = window.scrollY;
        smoothResetPdfView();
        
        window.scrollTo({ top: scrollY2, behavior: 'instant' });
        
        requestAnimationFrame(() => {
          window.scrollTo({ top: scrollY2, behavior: 'instant' });
        });
      }, 50);
    }
  }, [maximizedCard, toggleMaximizeCard, pdfState.pdfUrl, smoothResetPdfView]);

  const handleInsightsMaximizeToggle = useCallback(() => {
    const currentScrollY = window.scrollY;
    
    toggleMaximizeCard('insights');
    
    setTimeout(() => {
      window.scrollTo(0, currentScrollY);
    }, 50);
  }, [toggleMaximizeCard]);

  const handleClearSelectionWithInsights = useCallback(() => {
    const wasPreloadMode = isPreloadMode && selectedPaper;
    
    if (wasPreloadMode) {
      clearInsights(); 
      clearPdfState(); 
      clearPreloadedPaper(); 
      clearUIError(); 
      setValue("pdfFile", null, { shouldValidate: true });
      clearErrors();
    } else {
      handleClearSelection(); 
      clearInsights(); 
      clearPdfState(); 
      clearPreloadedPaper(); 
      clearUIError(); 
    }
  }, [handleClearSelection, clearInsights, clearPdfState, clearPreloadedPaper, clearUIError, isPreloadMode, selectedPaper, setValue, clearErrors]);

  useEffect(() => {
    if (uploadedFile && uploadedFile.length > 0) {
      const file = uploadedFile[0];
      updatePdfState({ fileName: file.name });
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          updatePdfState({
            pdfUrl: e.target.result as string,
            currentPage: 1,
            numPages: null,
            pdfZoom: 1.0
          });
          if (error) {
             clearUIError();
          }
          clearErrors("pdfFile");
        } else {
          setUIError("Failed to read file content. The result was empty.");
          updatePdfState({ pdfUrl: null });
        }
      };
      reader.onerror = () => {
        setUIError("Error reading the selected file. It might be corrupted or an unsupported format.");
        console.error("FileReader error occurred.");
        updatePdfState({ pdfUrl: null });
      };
      reader.readAsDataURL(file);
    } else {
       updatePdfState({
         fileName: null,
         pdfUrl: null,
         pdfZoom: 1.0,
         pdfDisplayWidth: undefined
       });
    }
  }, [uploadedFile, clearErrors]);

  const handleFormSubmit: SubmitHandler<FormSchema> = async (data) => {
    if (!data.pdfFile || data.pdfFile.length === 0) {
        setUIError("No PDF file selected or loaded to analyze.");
        return;
    }
    
    clearUIError();
    
    await submitPdf(data.pdfFile[0]);
  };

  const canAnalyze = (uploadedFile && uploadedFile.length > 0 && !formErrors.pdfFile) && !(isPreloadEnabled && isPreloadMode && selectedPaper);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!pdfState.pdfUrl || !pdfState.numPages) return;

      const target = event.target as HTMLElement;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable) {
        return;
      }

      if (event.key === "ArrowLeft") {
        if (pdfState.currentPage > 1) {
          event.preventDefault();
          pageControls.onPreviousPage();
        }
      } else if (event.key === "ArrowRight") {
        if (pdfState.currentPage < pdfState.numPages) {
          event.preventDefault();
          pageControls.onNextPage();
        }
      }
    };

    if (pdfState.pdfUrl && pdfState.numPages) {
      window.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [pdfState.pdfUrl, pdfState.numPages, pdfState.currentPage, pageControls]);


  const handleLoadPreloadedPaper = useCallback(async (paperId: string) => {
    const file = await loadPreloadedPaper(paperId);
    if (file) {
      handleSetPreloadedFile(file);
    }
  }, [loadPreloadedPaper, handleSetPreloadedFile]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="w-full max-w-7xl mx-auto py-6 md:py-8 text-center px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-primary">InsightGUIDE</h1>
        <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">Upload your PDF or provide a URL to extract valuable insights.</p>
      </header>

      <div className="w-full px-4 sm:px-6 lg:px-8">
        <Card className="w-full shadow-xl mb-6 md:mb-8">
          <CardContent className="p-4 sm:p-6">
            <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">

              <div className="space-y-1">
                  <div
                      className={cn(
                          "group p-6 border-2 border-dashed rounded-lg text-center transition-colors duration-150 ease-in-out",
                          isDraggingOver && !isUrlMode && !isPreloadMode ? "border-primary bg-primary/10 ring-2 ring-primary ring-offset-2 shadow-lg" : "border-border hover:border-primary/70",
                          isUrlMode || isPreloadMode ? "bg-muted/50 cursor-not-allowed opacity-60" : "cursor-pointer bg-card hover:bg-muted/30"
                      )}
                      onDragEnter={dragHandlers.onDragEnter}
                      onDragLeave={dragHandlers.onDragLeave}
                      onDragOver={dragHandlers.onDragOver}
                      onDrop={dragHandlers.onDrop}
                      onClick={() => {
                          if (!isUrlMode && !isPreloadMode && !isLoading && !isUrlLoading && document.getElementById('pdfFile')) {
                              (document.getElementById('pdfFile') as HTMLInputElement).click();
                          }
                      }}
                      role="button"
                      tabIndex={isUrlMode || isPreloadMode || isLoading || isUrlLoading ? -1 : 0}
                      onKeyDown={(e) => {
                          if (!isUrlMode && !isPreloadMode && !isLoading && !isUrlLoading && (e.key === 'Enter' || e.key === ' ')) {
                              e.preventDefault();
                              if (document.getElementById('pdfFile')) {
                                  (document.getElementById('pdfFile') as HTMLInputElement).click();
                              }
                          }
                      }}
                      aria-label={isDraggingOver && !isUrlMode && !isPreloadMode ? "Drop PDF file here" : (fileName && !formErrors.pdfFile && !isUrlMode && !isPreloadMode ? `Selected file: ${fileName}` : "Drag and drop a PDF file here, or click to select a file")}
                  >
                      <Input
                          id="pdfFile"
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          {...register("pdfFile")}
                          disabled={isLoading || isUrlLoading || isUrlMode || isPreloadMode}
                      />
                      {isDraggingOver && !isUrlMode && !isPreloadMode ? (
                          <div className="flex flex-col items-center justify-center pointer-events-none">
                              <UploadCloud className="w-12 h-12 text-primary mb-2" />
                              <p className="text-lg font-semibold text-primary">Drop PDF here</p>
                              <p className="text-xs text-primary/80">to upload</p>
                          </div>
                      ) : (
                          <div className="flex flex-col items-center justify-center pointer-events-none">
                              <UploadCloud className={cn("w-10 h-10 mb-2 transition-colors", isUrlMode || isPreloadMode ? "text-muted-foreground/50" : "text-muted-foreground group-hover:text-primary/70")} />
                              <p className={cn("text-base font-medium", isUrlMode || isPreloadMode ? "text-muted-foreground/70" : "text-foreground")}>
                                  {fileName && !formErrors.pdfFile && !isUrlMode && !isPreloadMode
                                      ? <span className="text-primary font-semibold">{`Selected: ${fileName}`}</span>
                                      : `Drag & drop PDF here, or click to select`}
                              </p>
                              <p className={cn("text-xs mt-1", isUrlMode || isPreloadMode ? "text-muted-foreground/60" : "text-muted-foreground")}>
                                  Max file size: {MAX_FILE_SIZE / (1024 * 1024)}MB
                              </p>
                          </div>
                      )}
                  </div>
                  {formErrors.pdfFile && !isUrlMode && !isPreloadMode && (
                      <p className="text-xs sm:text-sm text-destructive mt-1 px-1">{formErrors.pdfFile.message}</p>
                  )}
              </div>


              <div className="flex items-center space-x-2">
                <Switch
                  id="url-mode-switch"
                  checked={isUrlMode}
                  onCheckedChange={handleUrlModeToggle}
                  disabled={isLoading || isUrlLoading || isUrlModeDisabled}
                />
                <Label htmlFor="url-mode-switch" className={cn(isLoading || isUrlLoading || isUrlModeDisabled ? "cursor-not-allowed text-muted-foreground" : "")}>
                  Load PDF from URL
                </Label>
              </div>

              {isPreloadEnabled && (
                <div className="flex items-center space-x-2">
                  <Switch
                    id="preload-mode-switch"
                    checked={isPreloadMode}
                    onCheckedChange={handlePreloadModeToggle}
                    disabled={isLoading || isUrlLoading || isPreloadModeDisabled}
                  />
                  <Label htmlFor="preload-mode-switch" className={cn(isLoading || isUrlLoading || isPreloadModeDisabled ? "cursor-not-allowed text-muted-foreground" : "")}>
                    Load Example Paper
                  </Label>
                </div>
              )}

              {isUrlMode && (
                <div>
                  <Label htmlFor="pdfUrlInput" className="text-base sm:text-lg font-medium">PDF URL</Label>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 mt-1">
                    <Input
                      id="pdfUrlInput"
                      type="url"
                      placeholder="https://example.com/document.pdf"
                      value={pdfUrlInputValue}
                      onChange={(e) => setPdfUrlInputValue(e.target.value)}
                      className="flex-grow"
                      disabled={isLoading || isUrlLoading}
                    />
                    <Button
                      type="button"
                      onClick={handleLoadFromUrl}
                      disabled={isLoading || isUrlLoading || !pdfUrlInputValue.trim()}
                      className="w-full sm:w-auto"
                    >
                      {isUrlLoading ? ( <Loader2 className="mr-2 h-4 w-4 animate-spin" /> ) : ( <LinkIcon className="mr-2 h-4 w-4" /> )}
                      Load from URL
                    </Button>
                  </div>
                  {fileName && !formErrors.pdfFile && isUrlMode && (
                      <p className="text-xs sm:text-sm text-muted-foreground mt-1">Loaded: {fileName}</p>
                  )}
                  {urlError && (
                    <Alert variant="destructive" className="mt-3">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>URL Error</AlertTitle>
                      <AlertDescription>{urlError}</AlertDescription>
                    </Alert>
                  )}
                  {formErrors.pdfFile && isUrlMode && (
                      <p className="text-xs sm:text-sm text-destructive mt-1">{formErrors.pdfFile.message}</p>
                  )}
                </div>
              )}

              {/* Preload Section */}
              {isPreloadEnabled && isPreloadMode && (
                <div className="border-t pt-4">
                  <PreloadSelector
                    preloadedPapers={preloadedPapers}
                    selectedPaper={selectedPaper}
                    isPreloadLoading={isPreloadLoading}
                    isDisabled={isLoading || isUrlLoading || !!uploadedFile?.[0] || isUrlMode}
                    onLoadPaper={handleLoadPreloadedPaper}
                  />
                </div>
              )}

              <div className="flex justify-end items-center space-x-3 mt-4">
                { ((uploadedFile && uploadedFile.length > 0) || (isPreloadEnabled && isPreloadMode && selectedPaper)) && !formErrors.pdfFile &&
                    <Button variant="outline" size="sm" onClick={handleClearSelectionWithInsights} disabled={isLoading || isUrlLoading || isPreloadLoading} type="button">
                        Clear Selection
                    </Button>
                }
                <Button
                  type="submit"
                  disabled={isLoading || isUrlLoading || !canAnalyze || (isPreloadEnabled && isPreloadMode && !!selectedPaper)}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground px-6 py-3 text-base sm:text-lg"
                >
                  {isLoading ? ( <Loader2 className="mr-2 h-5 w-5 animate-spin" /> ) : ( <UploadCloud className="mr-2 h-5 w-5" /> )}
                  Analyze PDF
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8">
        { (isLoading || isUrlLoading) && !insights && (
            <div className="flex flex-col items-center justify-center p-6 md:p-8 my-4">
            <Loader2 className="h-10 w-10 sm:h-12 sm:w-12 animate-spin text-primary mb-3 sm:mb-4" />
            <p className="text-base sm:text-lg text-muted-foreground">
                {isLoading && "Analyzing your PDF..."}
                {isUrlLoading && !isLoading && "Loading PDF from URL..."}
            </p>
            </div>
        )}

        {error && !formErrors.pdfFile && (
            <Alert variant="destructive" className="mb-4 sm:mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
            </Alert>
        )}
      </div>


      <div 
        ref={dualPanesRef}
        className={cn(
          "grid gap-4 md:gap-6 flex-1 mb-8 md:mb-12 px-4 sm:px-6 lg:px-8",
          maximizedCard ? "grid-cols-1" : "md:grid-cols-2"
        )}
      >
        <InsightsViewer
          insights={insights}
          isLoading={isLoading}
          isUrlLoading={isUrlLoading}
          fileName={fileName}
          maximizedCard={maximizedCard}
          onToggleMaximize={handleInsightsMaximizeToggle}
          onTestInsights={isTestingEnabled ? setTestInsights : undefined}
        />

        <Card className={cn("shadow-md flex flex-col", maximizedCard === 'insights' ? 'hidden' : '')}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-lg sm:text-xl">
              <div className="flex items-center">
                <FileText className="mr-2 h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                PDF Viewer
              </div>
               <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handlePdfMaximizeToggle}
                aria-label={maximizedCard === 'pdf' ? "Minimize PDF viewer" : "Maximize PDF viewer"}
              >
                {maximizedCard === 'pdf' ? <Minimize className="h-5 w-5" /> : <Expand className="h-5 w-5" />}
              </Button>
            </CardTitle>
            {!pdfState.pdfUrl && !isLoading && !isUrlLoading && (
              <CardDescription className="text-xs sm:text-sm">Your loaded PDF will be displayed here.</CardDescription>
            )}
          </CardHeader>
          <CardContent className="flex-1 flex flex-col overflow-hidden">
             {pdfState.numPages && pdfState.pdfUrl && (
              <div className="mb-3 sm:mb-4 px-1 pt-1 flex flex-col items-center space-y-3">
                {/* Navigation Controls */}
                <div className="flex items-center justify-center space-x-2 sm:space-x-3">
                  <Button type="button" variant="outline" size="sm" onClick={pageControls.onPreviousPage} disabled={pdfState.currentPage <= 1}>
                    <ChevronLeft className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Previous</span>
                  </Button>
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    Page {pdfState.currentPage} of {pdfState.numPages}
                  </span>
                  <Button type="button" variant="outline" size="sm" onClick={pageControls.onNextPage} disabled={pdfState.currentPage >= pdfState.numPages}>
                    <span className="hidden sm:inline">Next</span> <ChevronRight className="h-4 w-4 sm:ml-1" />
                  </Button>
                </div>

                {/* Zoom Controls */}
                <div className="flex items-center justify-center space-x-1">
                  <Button type="button" variant="outline" size="icon" onClick={zoomControls.onZoomOut} disabled={pdfState.pdfZoom <= zoomControls.minZoom} aria-label="Zoom Out">
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-xs px-2 py-1 bg-muted hover:bg-primary hover:text-primary-foreground min-w-[3rem] cursor-pointer"
                      >
                        {Math.round(pdfState.pdfZoom * 100)}%
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-2">
                      <div className="grid grid-cols-3 gap-1">
                        <Button type="button" variant="ghost" size="sm" onClick={() => zoomControls.onSetZoom(0.5)} className="text-xs px-2 py-1 h-8">
                          50%
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => zoomControls.onSetZoom(0.75)} className="text-xs px-2 py-1 h-8">
                          75%
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => zoomControls.onSetZoom(1.0)} className="text-xs px-2 py-1 h-8">
                          100%
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => zoomControls.onSetZoom(1.25)} className="text-xs px-2 py-1 h-8">
                          125%
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => zoomControls.onSetZoom(1.5)} className="text-xs px-2 py-1 h-8">
                          150%
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => zoomControls.onSetZoom(2.0)} className="text-xs px-2 py-1 h-8">
                          200%
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                  
                  <Button type="button" variant="outline" size="icon" onClick={zoomControls.onZoomIn} disabled={pdfState.pdfZoom >= zoomControls.maxZoom} aria-label="Zoom In">
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  
                  <Button type="button" variant="outline" size="sm" onClick={zoomControls.onResetZoom} disabled={Math.abs(pdfState.pdfZoom - 1.0) < 0.01} aria-label="Reset Zoom">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                
                <p className="text-xs text-muted-foreground mt-2">
                  Use <kbd className="px-1.5 py-0.5 border rounded bg-muted text-xs font-sans">←</kbd> / <kbd className="px-1.5 py-0.5 border rounded bg-muted text-xs font-sans">→</kbd> arrow keys for page navigation.
                </p>
              </div>
            )}
            <ScrollArea ref={scrollAreaRef} className="flex-1 h-0 w-full border rounded-md bg-muted/20 mx-1 mb-1">
              <div 
                ref={pdfDisplayRef} 
                className="transition-all duration-300 ease-in-out will-change-transform" 
                style={{ minHeight: pdfState.pdfUrl ? '500px' : 'auto' }}
              >
              {pdfState.pdfUrl && pdfState.pdfDisplayWidth ? (
                <Document
                  file={pdfState.pdfUrl}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={(err) => {
                    console.error("Error loading PDF document for preview:", err);
                    const loadSource = fileName?.startsWith("downloaded_") ? "URL" : "file";
                    if (!formErrors.pdfFile) {
                          setUIError(`Failed to load PDF for preview from ${loadSource}: ${err.message}. The file might be corrupted or not a standard PDF. You can still try to analyze it if it was loaded successfully into the form.`);
                    }
                  }}
                  loading={<div className="flex items-center justify-center h-full py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <span className="ml-2 text-muted-foreground">Loading PDF preview...</span></div>}
                  noData={<div className="flex flex-col items-center justify-center h-full text-center p-4"><ServerCrash className="w-12 h-12 text-muted-foreground/50 mb-3" /><p className="text-muted-foreground ">No PDF selected or PDF is empty.</p></div>}
                  error={<div className="flex flex-col items-center justify-center h-full text-center p-4"><AlertCircle className="w-12 h-12 text-destructive mb-3" /><p className="text-destructive">Failed to display PDF preview.</p></div>}
                >
                  <Page
                    pageNumber={pdfState.currentPage}
                    renderTextLayer={true}
                    renderAnnotationLayer={false}
                    width={pdfState.pdfDisplayWidth ? pdfState.pdfDisplayWidth * pdfState.pdfZoom : undefined}
                    loading={<div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
                  />
                </Document>
              ) : (
                  !isLoading && !isUrlLoading && <div className="flex flex-col items-center justify-center h-full text-center p-4"><ServerCrash className="w-12 h-12 text-muted-foreground/50 mb-3" /><p className="text-muted-foreground">No PDF loaded yet for preview.</p></div>
              )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

