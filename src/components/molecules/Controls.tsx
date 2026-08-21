import {
  RiSkipBackLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiSkipForwardLine,
} from "@remixicon/react";

interface ControlsProps {
  pageInfo: string;
  onFirst: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLast: () => void;
  prevDisabled: boolean;
  nextDisabled: boolean;
}

const btnCls = "border-none outline-none bg-[#eeeeee] text-[#111] px-[14px] py-[9px] rounded-[6px] cursor-pointer text-[13px] transition-all hover:bg-white active:scale-97 disabled:opacity-35 disabled:cursor-default disabled:hover:bg-[#eeeeee] flex items-center gap-1.5 max-[700px]:px-[10px] max-[700px]:py-[8px] max-[700px]:text-[11px]";

export function Controls({ pageInfo, onFirst, onPrev, onNext, onLast, prevDisabled, nextDisabled }: ControlsProps) {
  return (
    <div className="w-full h-[60px] flex items-center justify-center gap-[10px] max-[700px]:gap-[4px] bg-[#080808f7] relative z-[100]">
      <button onClick={onFirst} disabled={prevDisabled} className={`${btnCls} max-[700px]:hidden`} aria-label="First page">
        <RiSkipBackLine size={15} /> <span>First</span>
      </button>
      <button onClick={onPrev} disabled={prevDisabled} className={btnCls} aria-label="Previous page">
        <RiArrowLeftSLine size={16} /> <span className="max-[700px]:hidden">Prev</span>
      </button>
      <div className="min-w-[150px] max-[700px]:min-w-[90px] text-center text-[#aaa] text-[13px] max-[700px]:text-[11px] tabular-nums">
        {pageInfo}
      </div>
      <button onClick={onNext} disabled={nextDisabled} className={btnCls} aria-label="Next page">
        <span className="max-[700px]:hidden">Next</span> <RiArrowRightSLine size={16} />
      </button>
      <button onClick={onLast} disabled={nextDisabled} className={`${btnCls} max-[700px]:hidden`} aria-label="Last page">
        <span>Last</span> <RiSkipForwardLine size={15} />
      </button>
    </div>
  );
}
