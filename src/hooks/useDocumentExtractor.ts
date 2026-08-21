import { useState, useCallback } from 'react';

export type ExtractStatus = 'idle' | 'extracting' | 'done' | 'error';

export function useDocumentExtractor() {
  const [status, setStatus] = useState<ExtractStatus>('idle');
  const [error, setError] = useState('');

  const extract = useCallback(async (file: File): Promise<string> => {
    setStatus('extracting'); setError('');
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      // text and markdown files
      if (ext === 'txt' || ext === 'md' || file.type === 'text/plain' || file.type === 'text/markdown') {
        const text = await file.text();
        if (!text.trim()) throw new Error('This file appears to be empty.');
        setStatus('done'); return text.trim();
      }
      // word files removed for ponytail compliance
      if (ext === 'pdf' || file.type === 'application/pdf') {
        const pdfjsLib = (window as any).pdfjsLib;
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
        const pages: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const content = await (await pdf.getPage(i)).getTextContent();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const pageText = (content.items as any[]).filter(i => typeof i.str === 'string').map(i => i.str).join(' ').trim();
          if (pageText) pages.push(pageText);
        }
        const fullText = pages.join('\n\n');
        if (!fullText.trim()) throw new Error('No text found in this PDF.');
        setStatus('done'); return fullText;
      }
      throw new Error(`Unsupported file type ".${ext}".`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to extract text from file.';
      setError(msg); setStatus('error'); throw new Error(msg);
    }
  }, []);
  return { status, error, extract };
}
