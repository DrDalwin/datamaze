"use client";

import { useState } from "react";
import {
  RiPlayLine, RiPauseLine, RiStopLine,
  RiSpeedUpLine, RiVoiceprintLine, RiVoiceRecognitionLine,
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
  currentPage?: number;
  totalPages?: number;
  goToPage?: (n: number) => void;
  onNextPage?: () => void;
  onPrevPage?: () => void;
}

export function ReaderSidebar({
  tts, textToSpeak,
  currentPage, totalPages, goToPage,
  onNextPage, onPrevPage
}: Props) {
  const isPlaying = tts.status === "playing";
  const isPaused = tts.status === "paused";

  const [desktopExpanded, setDesktopExpanded] = useState(true);

  const playPauseBtnNode = isPlaying ? (
    <button onClick={tts.pause} className="flex-1 bg-white text-black hover:bg-gray-200 h-12 rounded-xl text-[15px] font-medium flex items-center justify-center gap-2 transition-colors shadow-lg">
      <RiPauseLine size={20} className="shrink-0" /> <span className="hidden sm:inline">Pause</span>
    </button>
  ) : (
    <button onClick={() => isPaused ? tts.resume() : tts.speak(textToSpeak)} className="flex-1 bg-white text-black hover:bg-gray-200 h-12 rounded-xl text-[15px] font-medium flex items-center justify-center gap-2 transition-colors shadow-lg">
      <RiPlayLine size={20} className="shrink-0" /> <span className="hidden sm:inline">Play</span>
    </button>
  );

  const controlsNode = (
    <div className="flex flex-col gap-5">
      {/* Page nav */}
      {goToPage && currentPage !== undefined && totalPages !== undefined && (
        <div>
          <div className="flex justify-between text-[13px] text-white/60 mb-2 uppercase tracking-wide font-medium">
            <span className="flex items-center gap-1.5"><RiLayoutLine size={16} /> Page</span>
          </div>
          <div className="flex items-center justify-between bg-black/40 border border-white/10 p-1.5 rounded-xl">
            <button onClick={onPrevPage || (() => goToPage?.(currentPage - 1))} disabled={currentPage <= 1} className="flex items-center justify-center h-8 w-8 text-white hover:bg-white/10 rounded disabled:opacity-30 transition-colors"><RiArrowLeftSLine size={20} /></button>
            <span className="text-white text-[14px] font-medium tabular-nums">{currentPage} / {totalPages || "—"}</span>
            <button onClick={onNextPage || (() => goToPage?.(currentPage + 1))} disabled={currentPage >= (totalPages || 1)} className="flex items-center justify-center h-8 w-8 text-white hover:bg-white/10 rounded disabled:opacity-30 transition-colors"><RiArrowRightSLine size={20} /></button>
          </div>
        </div>
      )}

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
      <div className={`reader-sidebar hidden md:flex bg-black/40 backdrop-blur-md border-l border-white/10 shrink-0 overflow-y-auto overflow-x-hidden flex-col transition-[width] duration-300 relative ${desktopExpanded ? 'w-[300px] xl:w-[320px] p-6' : 'w-[64px] p-3 items-center'} gap-6`}>
        <div className={`flex w-full ${desktopExpanded ? 'justify-end' : 'justify-center'} mt-1`}>
          <button 
            onClick={() => setDesktopExpanded(!desktopExpanded)} 
            className="text-white/70 hover:text-white transition-colors flex items-center justify-center p-1 rounded-lg hover:bg-white/10"
            title={desktopExpanded ? "Collapse sidebar" : "Expand sidebar"}
          >
            {/* arrow points away from content: right=close, left=open */}
            {desktopExpanded ? <RiArrowRightSLine size={24} /> : <RiArrowLeftSLine size={24} />}
          </button>
        </div>

        {desktopExpanded ? (
          <>
            <div className="flex flex-col gap-3 mt-8">
              <h3 className="text-white/60 text-xs uppercase tracking-wider font-semibold">Playback</h3>
              <div className="flex items-center gap-2">
                {playPauseBtnNode}
                <button onClick={tts.stop} className="flex-1 bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 h-12 rounded-xl text-[15px] font-medium flex items-center justify-center gap-2 transition-colors">
                  <RiStopLine size={20} className="shrink-0" /> Stop
                </button>
              </div>
            </div>
            {controlsNode}
          </>
        ) : (
          <div className="flex flex-col items-center gap-6 mt-12 w-full">
            <button onClick={() => isPaused ? tts.resume() : isPlaying ? tts.pause() : tts.speak(textToSpeak)} className="w-10 h-10 bg-white text-black hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors">
              {isPlaying ? <RiPauseLine size={20} /> : <RiPlayLine size={20} />}
            </button>
          </div>
        )}
      </div>

      {/* Mobile bottom bar */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-[300]">
        <div className="bg-black/80 backdrop-blur-xl border-t border-white/10 flex items-center gap-2 px-3 py-3 safe-area-pb">
          {playPauseBtnNode}
          
          {currentPage !== undefined && totalPages !== undefined && (
            <div className="flex items-center shrink-0">
              <button onClick={onPrevPage || (() => goToPage?.(currentPage - 1))} disabled={currentPage <= 1} className="h-12 w-10 bg-white/5 text-white hover:bg-white/10 border border-white/5 rounded-l-xl flex items-center justify-center transition-colors disabled:opacity-30">
                <RiArrowLeftSLine size={20} />
              </button>
              <div className="flex flex-col items-center justify-center h-12 min-w-[48px] px-2 bg-white/5 border-y border-white/5">
                <span className="text-[9px] text-white/50 uppercase tracking-widest font-semibold leading-none mb-1">Page</span>
                <span className="text-white text-xs font-medium tabular-nums leading-none">{currentPage}/{totalPages}</span>
              </div>
              <button onClick={onNextPage || (() => goToPage?.(currentPage + 1))} disabled={currentPage >= (totalPages || 1)} className="h-12 w-10 bg-white/5 text-white hover:bg-white/10 border border-white/5 rounded-r-xl flex items-center justify-center transition-colors disabled:opacity-30">
                <RiArrowRightSLine size={20} />
              </button>
            </div>
          )}

          <button onClick={tts.stop} className="h-12 w-12 shrink-0 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded-xl flex items-center justify-center transition-colors ml-auto">
            <RiStopLine size={20} />
          </button>
        </div>
      </div>
    </>
  );
}
