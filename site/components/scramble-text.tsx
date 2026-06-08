"use client";

import { useRef, useCallback, useState, useEffect } from "react";

const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*";

export default function ScrambleText({
  text,
  className,
  interval = 0,
}: {
  text: string;
  className?: string;
  interval?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [isScrambling, setIsScrambling] = useState(false);

  const scramble = useCallback(() => {
    if (isScrambling) return;
    const el = ref.current;
    if (!el) return;
    setIsScrambling(true);
    let iteration = 0;
    const timer = setInterval(() => {
      el.innerText = text
        .split("")
        .map((char, i) => {
          if (char === " ") return " ";
          if (i < iteration) return text[i];
          return chars[Math.floor(Math.random() * chars.length)];
        })
        .join("");
      if (iteration >= text.length) {
        clearInterval(timer);
        setIsScrambling(false);
      }
      iteration += 1 / 2;
    }, 30);
  }, [text, isScrambling]);

  useEffect(() => {
    if (!interval || interval <= 0) return;
    const id = setInterval(scramble, interval);
    return () => clearInterval(id);
  }, [interval, scramble]);

  return (
    <span ref={ref} onMouseEnter={scramble} className={className}>
      {text}
    </span>
  );
}
