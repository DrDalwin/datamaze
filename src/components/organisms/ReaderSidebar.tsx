"use client";

import { useState } from "react";
import {
  RiPlayLine, RiPauseLine, RiStopLine,
  RiSpeedUpLine, RiVoiceprintLine, RiVoiceRecognitionLine,
  RiZoomInLine, RiZoomOutLine,
  RiArrowLeftSLine, RiArrowRightSLine,
  RiLayoutLine, RiSettings3Line, RiCloseLine
} from "@remixicon/react";

interface TTSProps {
  status: string;
  rate: number;
  pitch: number;
  setRate: (r: number) => void;
  setPitch: (p: number) => void;
  voices: { name: string; lang: string; voiceURI: string }[];
  selectedVoiceURI: string;
  setSelectedVoiceURI: (v: string) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  speak: (text: string) => void;
}

interface Props {
  tts: TTSProps;
  textToSpeak: string;
  zoom: number;
  setZoom: (fn: (z: number) => number) => void;
  zoomStep: number;
  minZoom: number;
  maxZoom: number;
  currentPage?: number;
  totalPages?: number;
  goToPage?: (n: number) => void;
}

export function ReaderSidebar({
  tts, textToSpeak, zoom, setZoom, zoomStep, minZoom, maxZoom,
  currentPage, totalPages, goToPage
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const isPlaying = tts.status === "playing";
  const isPaused = tts.status === "paused";

  const PlayPauseBtn = () => isPlaying ? (
    <button onClick={tts.pause} className="flex-1 bg-white text-black hover:bg-gray-200 h-12 rounded-xl text-[15px] font-medium flex items-center justify-center gap-2 transition-colors shadow-lg">
      <RiPauseLine size={20} className="shrink-0" /> <span className="hidden sm:inline">Pause</span>
    </button>
  ) : (
    <button onClick={() => isPaused ? tts.resume() : tts.speak(textToSpeak)} className="flex-1 bg-white text-black hover:bg-gray-200 h-12 rounded-xl text-[15px] font-medium flex items-center justify-center gap-2 transition-colors shadow-lg">
      <RiPlayLine size={20} className="shrink-0" /> <span className="hidden sm:inline">Play</span>
    </button>
  );

  const Controls = () => (
    <div className="flex flex-col gap-5">
      {/* Page nav */}
      {goToPage && currentPage !== undefined && totalPages !== undefined && (
        <div>
          <div className="flex justify-between text-[13px] text-white/60 mb-2 uppercase tracking-wide font-medium">
            <span className="flex items-center gap-1.5"><RiLayoutLine size={16} /> Page</span>
          </div>
          <div className="flex items-center justify-between bg-black/40 border border-white/10 p-1.5 rounded-xl">
            <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1} className="flex items-center justify-center h-8 w-8 text-white hover:bg-white/10 rounded disabled:opacity-30 transition-colors"><RiArrowLeftSLine size={20} /></button>
            <span className="text-white text-[14px] font-medium tabular-nums">{currentPage} / {totalPages || "—"}</span>
            <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages} className="flex items-center justify-center h-8 w-8 text-white hover:bg-white/10 rounded disabled:opacity-30 transition-colors"><RiArrowRightSLine size={20} /></button>
          </div>
        </div>
      )}

      {/* Zoom */}
      <div>
        <div className="flex justify-between text-[13px] text-white/60 mb-2 uppercase tracking-wide font-medium">
          <span className="flex items-center gap-1.5"><RiZoomInLine size={16} /> Zoom</span>
          <span>{Math.round(zoom * 100)}%</span>
        </div>
        <div className="flex items-center justify-between bg-black/40 border border-white/10 p-1.5 rounded-xl">
          <button onClick={() => setZoom(z => Math.max(minZoom, parseFloat((z - zoomStep).toFixed(2))))} className="flex items-center justify-center h-8 w-8 text-white hover:bg-white/10 rounded transition-colors"><RiZoomOutLine size={20} /></button>
          <span className="text-white text-[14px] font-medium tabular-nums">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(maxZoom, parseFloat((z + zoomStep).toFixed(2))))} className="flex items-center justify-center h-8 w-8 text-white hover:bg-white/10 rounded transition-colors"><RiZoomInLine size={20} /></button>
        </div>
      </div>

      {/* Speed */}
      <div>
        <div className="flex justify-between text-[13px] text-white/60 mb-2 uppercase tracking-wide font-medium">
          <span className="flex items-center gap-1.5"><RiSpeedUpLine size={16} /> Speed</span>
          <span>{tts.rate.toFixed(1)}x</span>
        </div>
        <input type="range" min="0.5" max="2" step="0.1" value={tts.rate} onChange={e => tts.setRate(Number(e.target.value))} className="w-full accent-white cursor-grab active:cursor-grabbing" />
      </div>

      {/* Pitch */}
      <div>
        <div className="flex justify-between text-[13px] text-white/60 mb-2 uppercase tracking-wide font-medium">
          <span className="flex items-center gap-1.5"><RiVoiceprintLine size={16} /> Pitch</span>
          <span>{tts.pitch.toFixed(1)}</span>
        </div>
        <input type="range" min="0.5" max="2" step="0.1" value={tts.pitch} onChange={e => tts.setPitch(Number(e.target.value))} className="w-full accent-white cursor-grab active:cursor-grabbing" />
      </div>

      {/* Voice */}
      <div>
        <div className="flex justify-between text-[13px] text-white/60 mb-2 uppercase tracking-wide font-medium">
          <span className="flex items-center gap-1.5"><RiVoiceRecognitionLine size={16} /> Voice</span>
        </div>
        <select value={tts.selectedVoiceURI} onChange={e => tts.setSelectedVoiceURI(e.target.value)} className="w-full bg-black/40 border border-white/10 text-white p-3 rounded-xl outline-none text-[14px]">
          {tts.voices.map(v => <option key={v.voiceURI} value={v.voiceURI} className="bg-[#111]">{v.name}</option>)}
        </select>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="reader-sidebar hidden md:flex bg-black/40 backdrop-blur-md border-l border-white/10 w-[300px] xl:w-[320px] shrink-0 overflow-y-auto flex-col p-6 gap-6">
        <div className="flex flex-col gap-3">
          <h3 className="text-white/60 text-xs uppercase tracking-wider font-semibold">Playback</h3>
          <div className="flex items-center gap-2">
            <PlayPauseBtn />
            <button onClick={tts.stop} className="flex-1 bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 h-12 rounded-xl text-[15px] font-medium flex items-center justify-center gap-2 transition-colors">
              <RiStopLine size={20} className="shrink-0" /> Stop
            </button>
          </div>
        </div>
        <Controls />
      </div>

      {/* Mobile bottom bar + sheet */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-[300]">
        {/* Expanded sheet */}
        {expanded && (
          <div className="bg-[#0d0d0d]/95 backdrop-blur-xl border-t border-white/10 p-5 max-h-[70vh] overflow-y-auto">
            <Controls />
          </div>
        )}

        {/* Always-visible bottom toolbar */}
        <div className="bg-black/80 backdrop-blur-xl border-t border-white/10 flex items-center gap-2 px-4 py-3 safe-area-pb">
          <PlayPauseBtn />
          <button onClick={tts.stop} className="h-12 w-12 shrink-0 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded-xl flex items-center justify-center transition-colors">
            <RiStopLine size={20} />
          </button>
          <button
            onClick={() => setExpanded(e => !e)}
            className="h-12 w-12 shrink-0 bg-white/10 text-white hover:bg-white/15 border border-white/10 rounded-xl flex items-center justify-center transition-colors"
          >
            {expanded ? <RiCloseLine size={20} /> : <RiSettings3Line size={20} />}
          </button>
        </div>
      </div>
    </>
  );
}
