"use client";

import { useState, useCallback, useEffect } from 'react';

interface PreloadedPaper {
  id: string;
  title: string;
  filename: string;
}

interface UsePreloadStateProps {
  onError: (error: string) => void;
  onSuccess: (fileName: string, insights: string) => void;
}

export function usePreloadState({ onError, onSuccess }: UsePreloadStateProps) {
  const [selectedPaper, setSelectedPaper] = useState<string | null>(null);
  const [isPreloadLoading, setIsPreloadLoading] = useState<boolean>(false);
  const [preloadedPapers, setPreloadedPapers] = useState<PreloadedPaper[]>([]);

  useEffect(() => {
    const loadPapers = async () => {
      try {
        const response = await fetch('/data/preload/papers.json');
        if (!response.ok) {
          throw new Error('Failed to load preloaded papers configuration');
        }
        const papers = await response.json();
        setPreloadedPapers(papers);
      } catch (err: any) {
        console.error('Error loading preloaded papers configuration:', err);
        onError(`Failed to load preloaded papers: ${err.message}`);

        setPreloadedPapers([]);
      }
    };

    loadPapers();
  }, [onError]);

  const loadPreloadedPaper = useCallback(async (paperId: string) => {
    const paper = preloadedPapers.find(p => p.id === paperId);
    if (!paper) {
      onError("Selected paper not found in preloaded data.");
      return;
    }

    setIsPreloadLoading(true);
    setSelectedPaper(paperId);

    try {
      const insightsResponse = await fetch(`/data/preload/MD/${paper.filename}.md`);
      if (!insightsResponse.ok) {
        throw new Error(`Failed to load insights for ${paper.title}`);
      }
      const insights = await insightsResponse.text();

      const pdfResponse = await fetch(`/data/preload/PDF/${paper.filename}.pdf`);
      if (!pdfResponse.ok) {
        throw new Error(`Failed to load PDF for ${paper.title}`);
      }
      const pdfBlob = await pdfResponse.blob();
      const pdfFile = new File([pdfBlob], `${paper.filename}.pdf`, { type: 'application/pdf' });

      onSuccess(`${paper.filename}.pdf`, insights);
      return pdfFile;

    } catch (err: any) {
      console.error("Error loading preloaded paper:", err);
      onError(`Failed to load preloaded paper: ${err.message}`);
      setSelectedPaper(null);
      return null;
    } finally {
      setIsPreloadLoading(false);
    }
  }, [onError, onSuccess, preloadedPapers]);

  const clearPreloadedPaper = useCallback(() => {
    setSelectedPaper(null);
  }, []);

  return {
    preloadedPapers,
    selectedPaper,
    isPreloadLoading,
    loadPreloadedPaper,
    clearPreloadedPaper,
  };
}
