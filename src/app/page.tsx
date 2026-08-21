"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Header } from "@/components/molecules/Header";
import { useTTS } from "@/hooks/useTTS";
import { useDocumentExtractor } from "@/hooks/useDocumentExtractor";

const MagazineViewer = dynamic(() => import("@/components/organisms/MagazineViewer").then(m => m.MagazineViewer), { ssr: false });

export default function Home() {
  const [readerMode, setReaderMode] = useState(false);
  const [extractedText, setExtractedText] = useState("");
  const [loadingReader, setLoadingReader] = useState(false);
  
  const tts = useTTS();
  const { extract } = useDocumentExtractor();

  const toggleReader = async () => {
    if (readerMode) {
      setReaderMode(false);
      tts.stop();
      return;
    }
    
    if (extractedText) {
      setReaderMode(true);
      tts.speak(extractedText);
      return;
    }

    setLoadingReader(true);
    try {
      const response = await fetch("/datamaze/datamaze.pdf");
      const blob = await response.blob();
      const file = new File([blob], "datamaze.pdf", { type: "application/pdf" });
      const text = await extract(file);
      setExtractedText(text);
      setReaderMode(true);
      tts.speak(text);
    } catch (err) {
      console.error("Failed to load audio:", err);
      alert("Failed to load Audio Mode.");
    } finally {
      setLoadingReader(false);
    }
  };

  return (
    <main className="flex h-screen overflow-hidden bg-[#111]">
      {loadingReader && (
        <div className="fixed inset-0 bg-black/90 text-white z-[9999] flex items-center justify-center">
          Preparing Audio...
        </div>
      )}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        <MagazineViewer 
          onToggleReader={toggleReader} 
          readerMode={readerMode}
          tts={tts}
          extractedText={extractedText}
        />
      </div>
    </main>
  );
}
