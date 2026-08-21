interface StatusTextProps {
  text: string;
  className?: string;
}

export function StatusText({ text, className = "" }: StatusTextProps) {
  return <div className={`text-[13px] text-[#aaa] ${className}`}>{text}</div>;
}
