import { Button } from "../atoms/Button";

interface ControlsProps {
  pageInfo: string;
  onFirst: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLast: () => void;
  prevDisabled: boolean;
  nextDisabled: boolean;
}

export function Controls({
  pageInfo,
  onFirst,
  onPrev,
  onNext,
  onLast,
  prevDisabled,
  nextDisabled,
}: ControlsProps) {
  return (
    <div className="w-full h-[60px] max-[700px]:gap-[4px] flex items-center justify-center gap-[10px] bg-[#080808f7] relative z-[100]">
      <Button onClick={onFirst} disabled={prevDisabled} className="max-[700px]:px-[10px] max-[700px]:py-[8px] max-[700px]:text-[11px] border-none outline-none bg-[#eeeeee] text-[#111] px-[17px] py-[9px] rounded-[6px] cursor-pointer text-[13px] transition-all hover:bg-white active:scale-97 disabled:opacity-35 disabled:cursor-default disabled:hover:bg-[#eeeeee]">
        ⏮ First
      </Button>
      <Button onClick={onPrev} disabled={prevDisabled} className="max-[700px]:px-[10px] max-[700px]:py-[8px] max-[700px]:text-[11px] border-none outline-none bg-[#eeeeee] text-[#111] px-[17px] py-[9px] rounded-[6px] cursor-pointer text-[13px] transition-all hover:bg-white active:scale-97 disabled:opacity-35 disabled:cursor-default disabled:hover:bg-[#eeeeee]">
        ◀ Previous
      </Button>
      <div className="min-w-[150px] max-[700px]:min-w-[90px] max-[700px]:text-[11px] text-center text-[#aaa] text-[13px]">
        {pageInfo}
      </div>
      <Button onClick={onNext} disabled={nextDisabled} className="max-[700px]:px-[10px] max-[700px]:py-[8px] max-[700px]:text-[11px] border-none outline-none bg-[#eeeeee] text-[#111] px-[17px] py-[9px] rounded-[6px] cursor-pointer text-[13px] transition-all hover:bg-white active:scale-97 disabled:opacity-35 disabled:cursor-default disabled:hover:bg-[#eeeeee]">
        Next ▶
      </Button>
      <Button onClick={onLast} disabled={nextDisabled} className="max-[700px]:px-[10px] max-[700px]:py-[8px] max-[700px]:text-[11px] border-none outline-none bg-[#eeeeee] text-[#111] px-[17px] py-[9px] rounded-[6px] cursor-pointer text-[13px] transition-all hover:bg-white active:scale-97 disabled:opacity-35 disabled:cursor-default disabled:hover:bg-[#eeeeee]">
        Last ⏭
      </Button>
    </div>
  );
}
