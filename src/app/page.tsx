"use client";

import { useState, useRef } from "react";
import dynamic from "next/dynamic";
import { useTTS } from "@/hooks/useTTS";
import { useDocumentExtractor } from "@/hooks/useDocumentExtractor";
import { ErrorBoundary } from "@/components/atoms/ErrorBoundary";

const MagazineViewer = dynamic(
  () => import("@/components/organisms/MagazineViewer").then(m => m.MagazineViewer),
  { ssr: false }
);

export default function Home() {
  const [readerMode, setReaderMode] = useState(false);
  const [extractedText, setExtractedText] = useState("");
  const [loadingReader, setLoadingReader] = useState(false);

  // ref so toggleReader can read latest text without stale closure
  const extractedTextRef = useRef("");

  const tts = useTTS();
  const { extract } = useDocumentExtractor();

  const handleExtractedText = (text: string) => {
    extractedTextRef.current = text;
    setExtractedText(text);
  };

  const toggleReader = async () => {
    if (readerMode) {
      setReaderMode(false);
      tts.stop();
      return;
    }

    if (extractedTextRef.current) {
      setReaderMode(true);
      // Removed tts.speak() — MagazineViewer handles toast hint instead
      return;
    }

    // text not ready yet — wait for bg extraction (max 8s) then fallback to manual extract
    setLoadingReader(true);
    try {
      let waited = 0;
      while (!extractedTextRef.current && waited < 40) {
        await new Promise(r => setTimeout(r, 200));
        waited++;
      }

      if (!extractedTextRef.current) {
        const response = await fetch("/datamaze/datamaze.pdf");
        const blob = await response.blob();
        const file = new File([blob], "datamaze.pdf", { type: "application/pdf" });
        const text = await extract(file);
        handleExtractedText(text);
      }

      setReaderMode(true);
      // Removed tts.speak() — MagazineViewer handles toast hint instead
    } catch (err) {
      console.error("Failed to load audio:", err);
      alert("Failed to load Audio Mode.");
    } finally {
      setLoadingReader(false);
    }
  };

  return (
    <main className="flex h-[100dvh] overflow-hidden bg-black">
      {loadingReader && (
        <div className="fixed inset-0 bg-black/90 text-white z-[9999] flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-4 border-white/20 border-t-indigo-400 rounded-full animate-spin" />
          <span className="text-sm text-white/70">Preparing Audio...</span>
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
