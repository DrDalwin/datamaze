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
        
        const pagePromises = Array.from({ length: pdf.numPages }, (_, i) => 
          pdf.getPage(i + 1).then((p: any) => p.getTextContent())
        );
        const contents = await Promise.all(pagePromises);
        
        const fullText = contents.map(content => 
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (content.items as any[]).filter(i => typeof i.str === 'string').map(i => i.str).join(' ').trim()
        ).filter(Boolean).join('\n\n');

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
