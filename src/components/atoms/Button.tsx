import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

const base = "border-none outline-none bg-[#eeeeee] text-[#111] px-[17px] py-[9px] rounded-[6px] cursor-pointer text-[13px] transition-all hover:bg-white active:scale-97 disabled:opacity-35 disabled:cursor-default disabled:hover:bg-[#eeeeee]";

export function Button({ children, className, ...props }: ButtonProps) {
  return (
    <button {...props} className={className ?? base}>
      {children}
    </button>
  );
}
