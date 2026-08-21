"use client";

import { useState, useRef } from "react";
import dynamic from "next/dynamic";
import { Header } from "@/components/molecules/Header";
import { useTTS } from "@/hooks/useTTS";
import { useDocumentExtractor } from "@/hooks/useDocumentExtractor";
import { ErrorBoundary } from "@/components/atoms/ErrorBoundary";

const MagazineViewer = dynamic(() => import("@/components/organisms/MagazineViewer").then(m => m.MagazineViewer), { ssr: false });

export default function Home() {
  const [readerMode, setReaderMode] = useState(false);
  const [extractedText, setExtractedText] = useState("");
  const textRef = useRef("");
  const [loadingReader, setLoadingReader] = useState(false);
  
  const tts = useTTS();
  const { extract } = useDocumentExtractor();

  const handleExtractedText = (text: string) => {
    setExtractedText(text);
    textRef.current = text;
  };

  const toggleReader = async () => {
    if (readerMode) {
      setReaderMode(false);
      tts.stop();
      return;
    }
    
    if (textRef.current) {
      setReaderMode(true);
      tts.speak(textRef.current);
      return;
    }

    setLoadingReader(true);
    // Wait for text extraction to finish if it hasn't already (poll every 200ms)
    // Normally it should finish in the background
    try {
      let loops = 0;
      while (!textRef.current && loops < 25) { // max 5 seconds wait
        await new Promise(r => setTimeout(r, 200));
        loops++;
      }
      
      if (!textRef.current) {
        const response = await fetch("/datamaze/datamaze.pdf");
        const blob = await response.blob();
        const file = new File([blob], "datamaze.pdf", { type: "application/pdf" });
        const text = await extract(file);
        setExtractedText(text);
        textRef.current = text;
      }
      setReaderMode(true);
      tts.speak(textRef.current);
    } catch (err) {
      console.error("Failed to load audio:", err);
      alert("Failed to load Audio Mode.");
    } finally {
      setLoadingReader(false);
    }
  };

  return (
    <main className="flex h-screen overflow-hidden bg-black">
      {loadingReader && (
        <div className="fixed inset-0 bg-black/90 text-white z-[9999] flex items-center justify-center">
          Preparing Audio...
        </div>
      )}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        <ErrorBoundary>
          <MagazineViewer 
            onToggleReader={toggleReader} 
            readerMode={readerMode}
            tts={tts}
            extractedText={extractedText}
            onExtractedText={handleExtractedText}
          />
        </ErrorBoundary>
      </div>
    </main>
  );
}
