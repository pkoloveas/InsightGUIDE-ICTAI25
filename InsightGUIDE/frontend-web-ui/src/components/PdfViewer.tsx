"use client";

import React from 'react';
import { Document, Page } from 'react-pdf';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  FileText, 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  RefreshCw, 
  Expand, 
  Minimize,
  Loader2,
  ServerCrash,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PdfViewerProps {
  pdfUrl: string | null;
  pdfDisplayWidth: number | undefined;
  currentPage: number;
  numPages: number | null;
  pdfZoom: number;
  isLoading: boolean;
  isUrlLoading: boolean;
  fileName: string | null;
  formErrors: any;
  maximizedCard: 'insights' | 'pdf' | null;
  onDocumentLoadSuccess: ({ numPages }: { numPages: number }) => void;
  onLoadError: (err: any) => void;
  onToggleMaximize: () => void;
  zoomControls: {
    onZoomIn: () => void;
    onZoomOut: () => void;
    onResetZoom: () => void;
    minZoom: number;
    maxZoom: number;
  };
  pageControls: {
    onPreviousPage: () => void;
    onNextPage: () => void;
  };
}

export function PdfViewer({
  pdfUrl,
  pdfDisplayWidth,
  currentPage,
  numPages,
  pdfZoom,
  isLoading,
  isUrlLoading,
  fileName,
  formErrors,
  maximizedCard,
  onDocumentLoadSuccess,
  onLoadError,
  onToggleMaximize,
  zoomControls,
  pageControls,
}: PdfViewerProps) {
  const pdfDisplayRef = React.useRef<HTMLDivElement>(null);

  return (
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
            onClick={onToggleMaximize}
            aria-label={maximizedCard === 'pdf' ? "Minimize PDF viewer" : "Maximize PDF viewer"}
          >
            {maximizedCard === 'pdf' ? <Minimize className="h-5 w-5" /> : <Expand className="h-5 w-5" />}
          </Button>
        </CardTitle>
        {!pdfUrl && !isLoading && !isUrlLoading && (
          <CardDescription className="text-xs sm:text-sm">
            Your loaded PDF will be displayed here.
          </CardDescription>
        )}
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col overflow-hidden">
        {numPages && pdfUrl && (
          <div className="mb-3 sm:mb-4 px-1 pt-1 flex flex-col items-center">
            <div className="flex items-center justify-center space-x-2 sm:space-x-3">
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={pageControls.onPreviousPage} 
                disabled={currentPage <= 1}
              >
                <ChevronLeft className="h-4 w-4 sm:mr-1" /> 
                <span className="hidden sm:inline">Prev
                </span>
              </Button>
              
              <span className="text-xs sm:text-sm text-muted-foreground">
                Page {currentPage} of {numPages}
              </span>
              
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={pageControls.onNextPage} 
                disabled={currentPage >= numPages}
              >
                <span className="hidden sm:inline">Next</span> 
                <ChevronRight className="h-4 w-4 sm:ml-1" />
              </Button>

              <div className="flex items-center space-x-1 ml-2 sm:ml-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="icon" 
                  onClick={zoomControls.onZoomOut} 
                  disabled={pdfZoom <= zoomControls.minZoom} 
                  aria-label="Zoom Out"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                
                <Button 
                  type="button" 
                  variant="outline" 
                  size="icon" 
                  onClick={zoomControls.onResetZoom} 
                  disabled={pdfZoom === 1.0} 
                  aria-label="Reset Zoom"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                
                <Button 
                  type="button" 
                  variant="outline" 
                  size="icon" 
                  onClick={zoomControls.onZoomIn} 
                  disabled={pdfZoom >= zoomControls.maxZoom} 
                  aria-label="Zoom In"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground mt-2">
              Use <kbd className="px-1.5 py-0.5 border rounded bg-muted text-xs font-sans">←</kbd> / <kbd className="px-1.5 py-0.5 border rounded bg-muted text-xs font-sans">→</kbd> arrow keys for page navigation.
            </p>
          </div>
        )}
        
        <ScrollArea ref={pdfDisplayRef} className="flex-1 h-0 w-full border rounded-md bg-muted/20 mx-1 mb-1">
          {pdfUrl && pdfDisplayWidth ? (
            <Document
              file={pdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onLoadError}
              loading={
                <div className="flex items-center justify-center h-full py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" /> 
                  <span className="ml-2 text-muted-foreground">Loading PDF preview...</span>
                </div>
              }
              noData={
                <div className="flex flex-col items-center justify-center h-full text-center p-4">
                  <ServerCrash className="w-12 h-12 text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">No PDF selected or PDF is empty.</p>
                </div>
              }
              error={
                <div className="flex flex-col items-center justify-center h-full text-center p-4">
                  <AlertCircle className="w-12 h-12 text-destructive mb-3" />
                  <p className="text-destructive">Failed to display PDF preview.</p>
                </div>
              }
            >
              <Page
                pageNumber={currentPage}
                renderTextLayer={true}
                renderAnnotationLayer={false}
                width={pdfDisplayWidth ? pdfDisplayWidth * pdfZoom : undefined}
                onRenderError={(error) => {
                  if (error.message && error.message.includes('TextLayer task cancelled')) {
                    console.debug('TextLayer rendering was cancelled (this is normal during navigation)');
                    return;
                  }
                  console.warn('PDF page render error:', error);
                }}
                loading={
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                }
              />
            </Document>
          ) : (
            !isLoading && !isUrlLoading && (
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <ServerCrash className="w-12 h-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No PDF loaded yet for preview.</p>
              </div>
            )
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
