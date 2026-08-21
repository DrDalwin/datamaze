"use client";

import { useState, useEffect } from "react";
import { RiFocus3Line } from "@remixicon/react";
import { useReaderLogic } from "@/hooks/useReaderLogic";
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
  text: string;
  fileName?: string;
  fileType?: string;
  tts: TTSProps;
  onClose: () => void;
}

const TagMap = { p: "p", heading1: "h1", heading2: "h2", heading3: "h3", code: "code", blockquote: "blockquote", listitem: "li", blank: "div" } as const;

export function DetailedReader({ text, tts, onClose }: Props) {  const [zoom, setZoom] = useState(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) return 0.85;
    return 1.0;
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  const {
    cleanText,
    segments,
    activeWordIdx,
    showScrollBtn,
    containerRef,
    activeWordRef,
    resumeAutoScroll,
    handleWordClick
  } = useReaderLogic(text, tts, onClose);

  return (
    <div className="reader-overlay flex-col md:flex-row">
      <div className="reader-main relative flex flex-col">
        {/* Progress bar directly at top */}
        <div className="w-full h-[4px] bg-white/5 cursor-pointer group flex-shrink-0 relative z-10 shadow-[0_2px_15px_rgba(0,0,0,0.8)]" onClick={e => {
          const r = e.currentTarget.getBoundingClientRect();
          tts.seek(Math.round(((e.clientX - r.left) / r.width) * 100));
        }}>
          <div className={`h-full bg-white/70 group-hover:bg-white shadow-[0_0_10px_rgba(255,255,255,0.4)] ${mounted ? "transition-[width] duration-300 ease-linear" : ""}`} style={{ width: `${tts.progress}%` }} />
        </div>

        <div ref={containerRef} className="reader-body flex-1">
          <div className="reader-paper" style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}>
            <div className="reader-content" onClick={(e) => {
              const el = e.target as HTMLElement;
              if (el.dataset.idx) handleWordClick(parseInt(el.dataset.idx, 10));
            }}>
            {segments.map((seg, sIdx) => {
              if (seg.type === "blank") return <br key={sIdx} />;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const Tag = TagMap[seg.type] as any;
              return (
                <Tag key={sIdx}>
                  {seg.words.map((w, i) => {
                    if (w.isWhitespace) return <span key={i}>{w.text}</span>;
                    const isActive = w.index === activeWordIdx;
                    return (
                      <span
                        key={i}
                        data-idx={w.index}
                        ref={isActive ? activeWordRef : null}
                        className={`reader-word ${isActive ? "active" : ""}`}
                      >
                        {w.text}
                      </span>
                    );
                  })}
                </Tag>
              );
            })}
            </div>
          </div>
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
        textToSpeak={cleanText}
        zoom={zoom}
        setZoom={setZoom}
        zoomStep={0.1}
        minZoom={0.6}
        maxZoom={3.0}
      />
    </div>
  );
}
