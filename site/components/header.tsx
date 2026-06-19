"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ScrambleText from "./scramble-text";
import ThemeToggle from "./theme-toggle";
import LiveClock from "./live-clock";

const links = [
  { href: "/", label: "About" },
  { href: "/projects", label: "Projects" },
  { href: "/blog", label: "Blog" },
  { href: "https://pics.andypandy.org", label: "Photos" },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 flex justify-center px-2 pt-2 sm:px-4 sm:pt-2.5">
      <nav className="flex items-center gap-3 rounded-full border border-gray-200/60 bg-white/70 px-3 py-1.5 shadow-sm backdrop-blur-xl sm:gap-6 sm:px-6 sm:py-2 dark:border-gray-800/60 dark:bg-gray-950/70">
        <Link
          href="/"
          className="text-base font-bold tracking-tight gradient-text font-display transition-opacity hover:opacity-80 sm:text-lg"
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
                  ? "nav-link-active text-gray-900 font-medium dark:text-gray-100"
                  : "text-gray-900 hover:text-gray-600 dark:text-gray-100 dark:hover:text-gray-300"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <div className="hidden h-4 w-px bg-gray-200 sm:block dark:bg-gray-700" />
          <div className="hidden sm:block">
            <LiveClock />
          </div>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
