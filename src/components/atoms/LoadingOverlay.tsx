import { RiBookOpenLine } from "@remixicon/react";

export function LoadingOverlay({ text, error }: { text: string; error: string | null }) {
  return (
    <div className="fixed inset-0 bg-black/95 text-white flex flex-col items-center justify-center gap-4 z-[10000]">
      <RiBookOpenLine size={36} className="text-indigo-400" />
      <div className="text-2xl font-bold tracking-wide">DATAMAZE</div>
      {!error ? (
        <>
          <div className="w-7 h-7 border-4 border-white/20 border-t-indigo-400 rounded-full animate-spin" />
          <div className="text-[14px] text-[#aaa] text-center px-5 max-w-sm">{text}</div>
        </>
      ) : (
        <div className="w-[min(750px,90vw)] p-6 text-center text-[#ff7777] leading-relaxed bg-[#28000059] border border-[#ff64644d] rounded-lg">
          {error}
        </div>
      )}
    </div>
  );
}
