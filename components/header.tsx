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
    <header className="sticky top-0 z-50 flex justify-center px-4 pt-4">
      <nav className="flex items-center gap-6 rounded-full border border-gray-200/60 bg-white/70 px-6 py-2.5 shadow-sm backdrop-blur-xl dark:border-gray-800/60 dark:bg-gray-950/70">
        <Link
          href="/"
          className="text-lg font-bold tracking-tight gradient-text transition-opacity hover:opacity-80"
        >
          <ScrambleText text="andy." interval={4000} />
        </Link>
        <div className="flex items-center gap-5">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-link text-sm transition-colors ${
                pathname === link.href
                  ? "nav-link-active text-gray-900 font-medium dark:text-gray-100"
                  : "text-gray-900 hover:text-gray-600 dark:text-gray-100 dark:hover:text-gray-300"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
          <LiveClock />
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
