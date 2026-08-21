"use client";

import { useState, useEffect } from "react";
import { RiFocus3Line } from "@remixicon/react";
import { usePDFLogic } from "@/hooks/usePDFLogic";
import { ReaderSidebar } from "./ReaderSidebar";

interface TTSProps {
  status: string;
  currentWord: string;
  progress: number;
  charIndex: number;
  speak: (text: string) => void;
  speakFromWord: (text: string, wordIndex: number) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  seek: (pct: number) => void;
  rate: number;
  pitch: number;
  setRate: (r: number) => void;
  setPitch: (p: number) => void;
  voices: { name: string; lang: string; voiceURI: string }[];
  selectedVoiceURI: string;
  setSelectedVoiceURI: (v: string) => void;
}

interface Props {
  file: File;
  extractedText: string;
  tts: TTSProps;
  onClose: () => void;
}

export function PDFViewer({ file, extractedText, tts, onClose }: Props) {
  const [zoom, setZoom] = useState(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) return 0.6;
    return 1.25;
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  const {
    pageMetas,
    currentPage,
    totalPages,
    loading,
    loadErr,
    activeWordIdx,
    showScrollBtn,
    containerRef,
    pageRefs,
    canvasRefs,
    activeWordRef,
    resumeAutoScroll,
    goToPage,
    handleWordClick,
  } = usePDFLogic(file, extractedText, tts, onClose, zoom);

  return (
    <div className="reader-overlay flex-col md:flex-row">
      <div className="reader-main relative">
        {/* Progress bar directly under navbar */}
        <div className="w-full h-[4px] bg-white/5 cursor-pointer group flex-shrink-0 relative z-10 shadow-[0_2px_15px_rgba(0,0,0,0.8)]" onClick={e => {
          const r = e.currentTarget.getBoundingClientRect();
          tts.seek(Math.round(((e.clientX - r.left) / r.width) * 100));
        }}>
          <div className={`h-full bg-white/70 group-hover:bg-white shadow-[0_0_10px_rgba(255,255,255,0.4)] ${mounted ? "transition-[width] duration-300 ease-linear" : ""}`} style={{ width: `${tts.progress}%` }} />
        </div>

        {/* PDF Document Area */}
        <div ref={containerRef} className="pdf-scroll-area">
          {loading ? (
            <div className="pdf-loading">Rendering PDF...</div>
          ) : loadErr ? (
            <div className="pdf-loading" style={{ color: "rgba(255,100,100,0.7)" }}>{loadErr}</div>
          ) : (
            pageMetas.map((meta, pi) => (
              <div key={pi} ref={el => { pageRefs.current[pi] = el; }} className="pdf-page-wrap" style={{ width: meta.naturalW * zoom, height: meta.naturalH * zoom }}>
                <canvas ref={el => { canvasRefs.current[pi] = el; }} className="pdf-page-canvas" />
                <div className="pdf-text-layer">
                  {meta.words.map((word, wi) => {
                    const isActive = word.globalIdx === activeWordIdx;
                    return (
                      <span
                        key={wi}
                        ref={isActive ? el => { activeWordRef.current = el; } : undefined}
                        onClick={() => handleWordClick(word.globalIdx)}
                        className={`pdf-word${isActive ? " active" : ""}`}
                        style={{ left: `${word.xPct * 100}%`, top: `${word.yPct * 100}%`, width: `${word.wPct * 100}%`, height: `${word.hPct * 100}%` }}
                      />
                    );
                  })}
                </div>
                <div className="pdf-page-badge">{pi + 1}</div>
              </div>
            ))
          )}
        </div>

        {/* Floating Auto-scroll Resume Button */}
        {showScrollBtn && (
          <button onClick={resumeAutoScroll} className="reader-autoscroll-btn hover:scale-105 transition-transform absolute bottom-10 left-1/2 -translate-x-1/2 z-[250] shadow-[0_8px_30px_rgb(0,0,0,0.5)]">
            <RiFocus3Line size={18} className="shrink-0" /> Resume auto-scroll
          </button>
        )}
      </div>

      <ReaderSidebar
        tts={tts}
        textToSpeak={extractedText}
        zoom={zoom}
        setZoom={setZoom}
        zoomStep={0.25}
        minZoom={0.5}
        maxZoom={3}
        currentPage={currentPage}
        totalPages={totalPages}
        goToPage={goToPage}
      />
    </div>
  );
}
