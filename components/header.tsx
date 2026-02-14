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
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-4 pt-4">
      <div className="flex-1" />
      <nav className="liquid-glass flex items-center gap-6 rounded-full px-6 py-2.5">
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
                  : "text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <ThemeToggle />
        </div>
      </nav>
      <div className="flex-1 flex justify-end">
        <LiveClock />
      </div>
    </header>
  );
}
