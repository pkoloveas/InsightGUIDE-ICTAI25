"use client";

import { useState, useCallback, useRef, useEffect } from 'react';

interface UsePdfStateProps {
  onError: (error: string) => void;
  clearErrors: () => void;
  maximizedCard?: 'insights' | 'pdf' | null;
}

interface PdfState {
  pdfUrl: string | null;
  numPages: number | null;
  currentPage: number;
  fileName: string | null;
  pdfDisplayWidth: number | undefined;
  pdfZoom: number;
  scrollPosition: number;
  resetKey: number;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 2.0;
const ZOOM_STEP = 0.1;

export function usePdfState({ onError, clearErrors, maximizedCard }: UsePdfStateProps) {
  const [pdfState, setPdfState] = useState<PdfState>({
    pdfUrl: null,
    numPages: null,
    currentPage: 1,
    fileName: null,
    pdfDisplayWidth: undefined,
    pdfZoom: 1.0,
    scrollPosition: 0,
    resetKey: 0,
  });

  const pdfDisplayRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const updatePdfState = useCallback((updates: Partial<PdfState>) => {
    setPdfState(prev => ({ ...prev, ...updates }));
  }, []);

  const clearPdfState = useCallback(() => {
    setPdfState({
      pdfUrl: null,
      numPages: null,
      currentPage: 1,
      fileName: null,
      pdfDisplayWidth: undefined,
      pdfZoom: 1.0,
      scrollPosition: 0,
      resetKey: 0,
    });
  }, []);

  const saveScrollPosition = useCallback(() => {
    if (scrollAreaRef.current) {
      const scrollTop = scrollAreaRef.current.scrollTop;
      updatePdfState({ scrollPosition: scrollTop });
    }
  }, [updatePdfState]);

  const restoreScrollPosition = useCallback(() => {
    if (scrollAreaRef.current && pdfState.scrollPosition > 0) {
      requestAnimationFrame(() => {
        if (scrollAreaRef.current) {
          scrollAreaRef.current.scrollTop = pdfState.scrollPosition;
        }
      });
    }
  }, [pdfState.scrollPosition]);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    const shouldResetPage = pdfState.numPages === null;
    const newCurrentPage = shouldResetPage ? 1 : Math.min(pdfState.currentPage, numPages);
    
    if (!shouldResetPage && pdfState.currentPage > 1) {
      console.log(`PDF reloaded: preserving page ${pdfState.currentPage} -> ${newCurrentPage} (total: ${numPages})`);
    }
    
    updatePdfState({ 
      numPages, 
      currentPage: newCurrentPage 
    });
  }, [updatePdfState, pdfState.numPages, pdfState.currentPage]);

  const onDocumentLoadError = useCallback((err: any) => {
    console.error("Error loading PDF document for preview:", err);
    const loadSource = pdfState.fileName?.startsWith("downloaded_") ? "URL" : "file";
    onError(
      `Failed to load PDF for preview from ${loadSource}: ${err.message}. ` +
      "The file might be corrupted or not a standard PDF. " +
      "You can still try to analyze it if it was loaded successfully into the form."
    );
  }, [pdfState.fileName, onError]);

  const goToPrevPage = useCallback(() => {
    saveScrollPosition();
    updatePdfState({ currentPage: Math.max(pdfState.currentPage - 1, 1) });
    // Restore scroll position after a short delay to allow React to re-render
    setTimeout(restoreScrollPosition, 50);
  }, [pdfState.currentPage, updatePdfState, saveScrollPosition, restoreScrollPosition]);

  const goToNextPage = useCallback(() => {
    saveScrollPosition();
    updatePdfState({ 
      currentPage: Math.min(pdfState.currentPage + 1, pdfState.numPages || 1) 
    });
    setTimeout(restoreScrollPosition, 50);
  }, [pdfState.currentPage, pdfState.numPages, updatePdfState, saveScrollPosition, restoreScrollPosition]);

  const handleZoomIn = useCallback(() => {
    updatePdfState({ 
      pdfZoom: Math.min(pdfState.pdfZoom + ZOOM_STEP, MAX_ZOOM) 
    });
  }, [pdfState.pdfZoom, updatePdfState]);

  const handleZoomOut = useCallback(() => {
    updatePdfState({ 
      pdfZoom: Math.max(pdfState.pdfZoom - ZOOM_STEP, MIN_ZOOM) 
    });
  }, [pdfState.pdfZoom, updatePdfState]);

  const handleResetZoom = useCallback(() => {
    updatePdfState({ pdfZoom: 1.0 });
  }, [updatePdfState]);

  const handleSetZoom = useCallback((zoom: number) => {
    updatePdfState({ pdfZoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom)) });
  }, [updatePdfState]);

  const resetPdfViewState = useCallback(() => {
    updatePdfState({ 
      pdfZoom: 1.0, 
      scrollPosition: 0,
      pdfDisplayWidth: undefined
    });
    
    setTimeout(() => {
      if (pdfDisplayRef.current) {
        const approxPaddingValue = 32;
        const newWidth = Math.max(pdfDisplayRef.current.offsetWidth - approxPaddingValue, 200);
        updatePdfState({ pdfDisplayWidth: newWidth });
      }
    }, 50);
  }, [updatePdfState]);

  const smoothResetZoom = useCallback(() => {
    updatePdfState({ 
      pdfZoom: 1.0, 
      scrollPosition: 0
    });
  }, [updatePdfState]);

  const forceResetPdfView = useCallback(() => {
    updatePdfState({ 
      pdfZoom: 1.0, 
      scrollPosition: 0,
      resetKey: pdfState.resetKey + 1
    });
  }, [updatePdfState, pdfState.resetKey]);

  const smoothResetPdfView = useCallback(() => {
    requestAnimationFrame(() => {
      updatePdfState({ 
        pdfZoom: 1.0, 
        scrollPosition: 0,
        pdfDisplayWidth: undefined
      });
      
      requestAnimationFrame(() => {
        if (pdfDisplayRef.current) {
          const approxPaddingValue = 32;
          const newWidth = Math.max(pdfDisplayRef.current.offsetWidth - approxPaddingValue, 200);
          updatePdfState({ pdfDisplayWidth: newWidth });
        }
      });
    });
  }, [updatePdfState]);

  const prevMaximizedRef = useRef<'insights' | 'pdf' | null>(maximizedCard ?? null);

  useEffect(() => {
    function updatePdfDisplayWidth() {
      if (pdfDisplayRef.current) {
        const approxPaddingValue = 32;
        const newWidth = Math.max(pdfDisplayRef.current.offsetWidth - approxPaddingValue, 200);
        
        updatePdfState({
          pdfDisplayWidth: newWidth
        });
      }
    }

    if (pdfState.pdfUrl) {
      const prevMaximized = prevMaximizedRef.current;
      const currentMaximized = maximizedCard;
      
      const transitioningToMaximized = prevMaximized !== 'pdf' && currentMaximized === 'pdf';
      const transitioningToMinimized = prevMaximized === 'pdf' && currentMaximized !== 'pdf';
      
      if (transitioningToMaximized || transitioningToMinimized) {
        updatePdfState({ 
          pdfZoom: 1.0, 
          scrollPosition: 0
        });
      }
      
      const delay = maximizedCard === 'pdf' ? 350 : 150;
      
      const timeoutId = setTimeout(() => {
        updatePdfDisplayWidth();
      }, delay);

      window.addEventListener('resize', updatePdfDisplayWidth);
      
      prevMaximizedRef.current = maximizedCard ?? null;
      
      return () => {
        window.removeEventListener('resize', updatePdfDisplayWidth);
        clearTimeout(timeoutId);
      };
    } else {
      updatePdfState({ pdfDisplayWidth: undefined });
      prevMaximizedRef.current = maximizedCard ?? null;
    }
  }, [pdfState.pdfUrl, maximizedCard, updatePdfState]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!pdfState.pdfUrl || !pdfState.numPages) return;

      const target = event.target as HTMLElement;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable) {
        return;
      }

      if (event.key === "ArrowLeft" && pdfState.currentPage > 1) {
        event.preventDefault();
        goToPrevPage();
      } else if (event.key === "ArrowRight" && pdfState.currentPage < pdfState.numPages) {
        event.preventDefault();
        goToNextPage();
      }
    };

    if (pdfState.pdfUrl && pdfState.numPages) {
      window.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [pdfState.pdfUrl, pdfState.numPages, pdfState.currentPage, goToPrevPage, goToNextPage]);

  return {
    pdfState,
    pdfDisplayRef,
    scrollAreaRef,
    updatePdfState,
    clearPdfState,
    resetPdfViewState,
    forceResetPdfView,
    smoothResetPdfView,
    onDocumentLoadSuccess,
    onDocumentLoadError,
    pageControls: {
      onPreviousPage: goToPrevPage,
      onNextPage: goToNextPage,
    },
    zoomControls: {
      onZoomIn: handleZoomIn,
      onZoomOut: handleZoomOut,
      onResetZoom: handleResetZoom,
      onSetZoom: handleSetZoom,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      currentZoom: pdfState.pdfZoom,
    },
  };
}
