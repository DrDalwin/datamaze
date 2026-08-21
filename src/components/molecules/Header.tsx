import {
  RiBookOpenLine,
  RiHeadphoneLine,
  RiVolumeMuteLine,
  RiFullscreenLine,
  RiFullscreenExitLine,
} from "@remixicon/react";
import { useState } from "react";
import { StatusText } from "../atoms/StatusText";

interface HeaderProps {
  status: string;
  onToggleReader?: () => void;
  readerMode?: boolean;
  ttsSupported?: boolean;
}

export function Header({ status, onToggleReader, readerMode, ttsSupported = true }: HeaderProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div className="w-full h-[58px] max-[700px]:h-[50px] max-[700px]:px-[12px] flex items-center justify-between px-[25px] bg-[#080808f7] text-white relative z-[100]">
      <div className="flex items-center gap-2.5 text-[19px] font-bold tracking-[.5px] max-[700px]:text-[14px]" aria-label="DATAMAZE Digital Magazine">
        <RiBookOpenLine size={22} className="text-indigo-400 shrink-0 max-[700px]:hidden" />
        DATAMAZE DIGITAL MAGAZINE
      </div>
      <div className="flex items-center gap-3">
        {onToggleReader && (
          ttsSupported ? (
            <button
              onClick={onToggleReader}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors text-white font-medium ${readerMode ? "bg-red-600 hover:bg-red-700" : "bg-indigo-500 hover:bg-indigo-600"}`}
              aria-pressed={readerMode}
              aria-label={readerMode ? "Exit Audio Edition" : "Start Audio Edition"}
            >
              {readerMode ? <RiVolumeMuteLine size={15} /> : <RiHeadphoneLine size={15} />}
              <span className="max-[500px]:hidden">{readerMode ? "Exit Audio Mode" : "Listen to Magazine"}</span>
            </button>
          ) : (
            <span
              className="flex items-center gap-1.5 text-xs bg-gray-800 text-gray-500 px-3 py-1.5 rounded-md cursor-not-allowed"
              title="Speech synthesis not supported in this browser. Try Chrome or Edge."
              role="alert"
            >
              <RiVolumeMuteLine size={15} />
              <span className="max-[500px]:hidden">Audio unavailable</span>
            </span>
          )
        )}
        <button
          onClick={toggleFullscreen}
          className="flex items-center justify-center bg-gray-700 hover:bg-gray-600 text-white w-8 h-8 rounded-md transition-colors"
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {isFullscreen ? <RiFullscreenExitLine size={16} /> : <RiFullscreenLine size={16} />}
        </button>
        {status !== "Ready" && <StatusText text={status} className="max-[700px]:text-[11px]" />}
      </div>
    </div>
  );
}
