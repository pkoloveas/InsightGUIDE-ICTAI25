import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Downloads content as a file with the specified filename
 */
export function downloadAsFile(content: string, filename: string, mimeType: string = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates a markdown filename from a PDF filename
 */
export function generateMarkdownFilename(pdfFilename: string | null): string {
  if (!pdfFilename) {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    return `insights_${timestamp}.md`;
  }
  
  // Remove .pdf extension and add .md
  const baseName = pdfFilename.replace(/\.pdf$/i, '');
  return `${baseName}.md`;
}
