"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ScrambleText from "./scramble-text";
import ThemeToggle from "./theme-toggle";
import LiveClock from "./live-clock";

const links = [
  { href: "/", label: "About" },
  { href: "/projects", label: "Projects" },
  { href: "https://pics.andypandy.org", label: "Photos" },
  { href: "/blog", label: "Blog" },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 flex justify-center px-2 pt-3 sm:px-4 sm:pt-4">
      <nav className="flex items-center gap-3 rounded-full border border-pink-200/60 bg-white/70 px-3 py-1.5 shadow-sm shadow-pink-200/20 backdrop-blur-xl sm:gap-6 sm:px-6 sm:py-2.5 dark:border-purple-500/20 dark:bg-[#1a1030]/80 dark:shadow-purple-900/20">
        <Link
          href="/"
          className="text-base font-bold tracking-tight gradient-text transition-opacity hover:opacity-80 sm:text-lg"
        >
          <ScrambleText text="andy." interval={4000} />
        </Link>
        <div className="flex items-center gap-2.5 sm:gap-5">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-link text-xs transition-colors sm:text-sm ${
                pathname === link.href
                  ? "nav-link-active text-purple-900 font-medium dark:text-purple-200"
                  : "text-purple-800 hover:text-pink-500 dark:text-purple-300 dark:hover:text-pink-400"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <div className="hidden h-4 w-px bg-pink-200 sm:block dark:bg-purple-700" />
          <div className="hidden sm:block">
            <LiveClock />
          </div>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
