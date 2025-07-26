"use client";

import { useState, useCallback } from 'react';

type MaximizedCard = 'insights' | 'pdf' | null;

export function useUIState() {
  const [error, setError] = useState<string | null>(null);
  const [maximizedCard, setMaximizedCard] = useState<MaximizedCard>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const toggleMaximizeCard = useCallback((cardType: 'insights' | 'pdf') => {
    setMaximizedCard(prev => (prev === cardType ? null : cardType));
  }, []);

  return {
    error,
    setError,
    clearError,
    maximizedCard,
    toggleMaximizeCard,
  };
}
