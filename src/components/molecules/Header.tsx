import { StatusText } from "../atoms/StatusText";

export function Header({ status, onToggleReader, readerMode }: { status: string; onToggleReader?: () => void; readerMode?: boolean }) {
  return (
    <div className="w-full h-[58px] max-[700px]:h-[50px] max-[700px]:px-[12px] flex items-center justify-between px-[25px] bg-[#080808f7] text-white relative z-[100]">
      <div className="text-[19px] font-bold tracking-[.5px] max-[700px]:text-[14px]">
        📖 DATAMAZE DIGITAL MAGAZINE
      </div>
      <div className="flex items-center gap-4">
        {onToggleReader && (
          <button 
            onClick={onToggleReader} 
            className="text-xs bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-md transition-colors"
          >
            {readerMode ? 'Close Audio' : 'Listen to this Magazine'}
          </button>
        )}
        {status !== "Ready" && <StatusText text={status} className="max-[700px]:text-[11px]" />}
      </div>
    </div>
  );
}
