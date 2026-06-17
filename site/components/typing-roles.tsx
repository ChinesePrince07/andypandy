"use client";

import { useEffect, useState } from "react";

const ROLES = [
  "embedded systems",
  "full-stack web apps",
  "calculator hacking",
  "iOS apps",
];

// Terminal-style typing line for the hero. Types and erases through ROLES.
// Honors prefers-reduced-motion by rendering the first role statically.
export default function TypingRoles({ className }: { className?: string }) {
  const [text, setText] = useState("");

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setText(ROLES[0]);
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    let word = 0;
    let len = 0;
    let deleting = false;

    const tick = () => {
      const current = ROLES[word % ROLES.length];
      len += deleting ? -1 : 1;
      setText(current.slice(0, len));

      let delay = deleting ? 40 : 80;
      if (!deleting && len === current.length) {
        deleting = true;
        delay = 1500; // hold the full word
      } else if (deleting && len === 0) {
        deleting = false;
        word += 1;
        delay = 350;
      }
      timer = setTimeout(tick, delay);
    };

    timer = setTimeout(tick, 700);
    return () => clearTimeout(timer);
  }, []);

  return (
    <span className={className}>
      <span aria-hidden="true">{text}</span>
      <span
        aria-hidden="true"
        className="ml-px inline-block h-[1.05em] w-[2px] translate-y-[0.18em] bg-accent animate-cursor-blink"
      />
      <span className="sr-only">
        embedded systems, full-stack web apps, and more
      </span>
    </span>
  );
}
