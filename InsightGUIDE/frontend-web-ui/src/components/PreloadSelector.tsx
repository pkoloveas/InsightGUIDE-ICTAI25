"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, BookOpen, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PreloadedPaper {
  id: string;
  title: string;
  filename: string;
}

interface PreloadSelectorProps {
  preloadedPapers: PreloadedPaper[];
  selectedPaper: string | null;
  isPreloadLoading: boolean;
  isDisabled: boolean;
  onLoadPaper: (paperId: string) => void;
}

export function PreloadSelector({
  preloadedPapers,
  selectedPaper,
  isPreloadLoading,
  isDisabled,
  onLoadPaper,
}: PreloadSelectorProps) {
  const [tempSelectedPaper, setTempSelectedPaper] = React.useState<string>("");

  React.useEffect(() => {
    if (!selectedPaper) {
      setTempSelectedPaper("");
    }
  }, [selectedPaper]);

  const handleLoadClick = () => {
    if (tempSelectedPaper) {
      onLoadPaper(tempSelectedPaper);
    }
  };

  const selectedPaperInfo = preloadedPapers.find(p => p.id === selectedPaper);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-base sm:text-lg font-medium flex items-center">
          <Sparkles className="mr-2 h-5 w-5 text-primary" />
          Load Example Paper
        </Label>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Choose from pre-analyzed papers to see the insights feature in action.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-end space-y-3 sm:space-y-0 sm:space-x-3">
        <div className="flex-grow w-full">
          <Select
            value={tempSelectedPaper}
            onValueChange={setTempSelectedPaper}
            disabled={isDisabled || isPreloadLoading}
          >
            <SelectTrigger className={cn(
              "w-full",
              isDisabled && "cursor-not-allowed opacity-60"
            )}>
              <SelectValue placeholder="Select an example paper..." />
            </SelectTrigger>
            <SelectContent>
              {preloadedPapers.map((paper) => (
                <SelectItem key={paper.id} value={paper.id}>
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{paper.title}</span>
                    <span className="text-xs text-muted-foreground">{paper.filename}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex space-x-2 w-full sm:w-auto">
          <Button
            type="button"
            onClick={handleLoadClick}
            disabled={!tempSelectedPaper || isDisabled || isPreloadLoading}
            className="w-full sm:w-auto"
          >
            {isPreloadLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <BookOpen className="mr-2 h-4 w-4" />
            )}
            Load Example
          </Button>
        </div>
      </div>

      {selectedPaperInfo && (
        <Alert className="border-primary/20 bg-primary/5">
          <BookOpen className="h-4 w-4 text-primary" />
          <AlertTitle className="text-primary">Example Loaded</AlertTitle>
          <AlertDescription>
            <strong>{selectedPaperInfo.title}</strong>
            <br />
            <span className="text-xs text-muted-foreground">
              File: {selectedPaperInfo.filename}.pdf
            </span>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
