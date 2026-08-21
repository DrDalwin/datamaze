"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Header } from "@/components/molecules/Header";
import { useTTS } from "@/hooks/useTTS";
import { useDocumentExtractor } from "@/hooks/useDocumentExtractor";

const MagazineViewer = dynamic(() => import("@/components/organisms/MagazineViewer").then(m => m.MagazineViewer), { ssr: false });
const PDFViewer = dynamic(() => import("@/components/organisms/PDFViewer").then(m => m.PDFViewer), { ssr: false });

export default function Home() {
  const [readerMode, setReaderMode] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
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
    
    if (pdfFile && extractedText) {
      setReaderMode(true);
      return;
    }

    setLoadingReader(true);
    try {
      const response = await fetch("/datamaze/datamaze.pdf");
      const blob = await response.blob();
      const file = new File([blob], "datamaze.pdf", { type: "application/pdf" });
      const text = await extract(file);
      setPdfFile(file);
      setExtractedText(text);
      setReaderMode(true);
    } catch (err) {
      console.error("Failed to load reader mode:", err);
      alert("Failed to load Reader Mode.");
    } finally {
      setLoadingReader(false);
    }
  };

  if (readerMode && pdfFile) {
    return (
      <main className="flex flex-col h-screen overflow-hidden vesper-root">
        <Header status="Detailed Reader Mode" onToggleReader={toggleReader} readerMode={true} />
        <PDFViewer file={pdfFile} extractedText={extractedText} tts={tts} onClose={() => setReaderMode(false)} />
      </main>
    );
  }

  return (
    <main>
      {loadingReader && (
        <div className="fixed inset-0 bg-black/90 text-white z-[9999] flex items-center justify-center">
          Preparing Detailed Reader...
        </div>
      )}
      <MagazineViewer onToggleReader={toggleReader} />
    </main>
  );
}
