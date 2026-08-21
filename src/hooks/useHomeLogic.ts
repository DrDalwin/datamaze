import { useState, useEffect } from "react";
import { useDocumentExtractor } from "@/hooks/useDocumentExtractor";
import { useTTS } from "@/hooks/useTTS";

export function useHomeLogic() {
  const [mounted, setMounted] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [showReader, setShowReader] = useState(false);
  const [showUploader, setShowUploader] = useState(false);
  const { status: extractStatus, error: extractError, extract } = useDocumentExtractor();
  const tts = useTTS();
  const isExtracting = extractStatus === "extracting";

  // set mounted true on init
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  // run appear animations on load
  useEffect(() => {
    const appears = document.querySelectorAll(".appear, .badge-star, h1 em");
    const handleEnd = (e: Event) => (e.target as Element).classList.add("is-in");
    appears.forEach((el) => el.addEventListener("animationend", handleEnd, { once: true }));
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const isRunning = Array.from(appears).some((el) => el.getAnimations().some((a) => a.playState === "running" || a.playState === "finished"));
      if (!isRunning) document.querySelectorAll(".appear, .hero-photo, .badge-star, h1 em").forEach((el) => el.classList.add("is-in"));
    }));
    return () => appears.forEach((el) => el.removeEventListener("animationend", handleEnd));
  }, []);

  // listen for keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowReader(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const handleFile = async (file: File) => {
    if (file.size > 50 * 1024 * 1024) return;
    tts.stop(); setSelectedFile(file); setExtractedText("");
    try {
      const text = await extract(file);
      setExtractedText(text);
    } catch { /* extract failed silently */ }
  };

  const handleClear = () => {
    setSelectedFile(null); setExtractedText(""); tts.stop(); setShowReader(false);
  };

  const handlePasteText = (text: string) => {
    tts.stop();
    setSelectedFile(new File([text], "Pasted Text", { type: "text/plain" }));
    setExtractedText(text); setShowUploader(false);
  };

  return { mounted, selectedFile, extractedText, isDragging, setIsDragging, showReader, setShowReader, showUploader, setShowUploader, extractStatus, extractError, isExtracting, tts, handleFile, handleClear, handlePasteText };
}
