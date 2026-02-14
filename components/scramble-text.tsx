"use client";

import { useRef, useCallback, useState } from "react";

const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export default function ScrambleText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [isScrambling, setIsScrambling] = useState(false);

  const onHover = useCallback(() => {
    if (isScrambling) return;
    const el = ref.current;
    if (!el) return;
    setIsScrambling(true);
    let iteration = 0;
    const interval = setInterval(() => {
      el.innerText = text
        .split("")
        .map((char, i) => {
          if (char === " ") return " ";
          if (i < iteration) return text[i];
          return chars[Math.floor(Math.random() * chars.length)];
        })
        .join("");
      if (iteration >= text.length) {
        clearInterval(interval);
        setIsScrambling(false);
      }
      iteration += 1 / 2;
    }, 30);
  }, [text, isScrambling]);

  return (
    <span ref={ref} onMouseEnter={onHover} className={className}>
      {text}
    </span>
  );
}
