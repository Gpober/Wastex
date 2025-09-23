// src/components/ui/button.tsx
import React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  className?: string;
};

export function Button({ children, className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 bg-[#3CA9E0] text-white font-medium transition focus:outline-none focus:ring-2 focus:ring-[#2B91C0]/40 focus:ring-offset-2 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
