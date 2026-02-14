import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-gray-200/60">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-8 text-sm text-gray-400">
        <p>&copy; {new Date().getFullYear()} Andy</p>
        <div className="flex items-center gap-5">
          <a
            href="https://github.com/andypandy"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-700 transition-colors"
          >
            GitHub
          </a>
          <Link
            href="/feed.xml"
            className="hover:text-gray-700 transition-colors"
          >
            RSS
          </Link>
          <Link
            href="/admin"
            className="hover:text-gray-700 transition-colors"
          >
            Admin
          </Link>
        </div>
      </div>
    </footer>
  );
}
