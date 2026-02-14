import Link from "next/link";

export default function Footer() {
  return (
    <footer>
      <div className="divider" />
      <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-8 text-sm text-gray-400 dark:text-gray-500">
        <p className="mono">&copy; {new Date().getFullYear()} Andy</p>
        <div className="flex items-center gap-5">
          <a
            href="https://github.com/ChinesePrince07"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-700 transition-colors dark:hover:text-gray-300"
          >
            GitHub
          </a>
          <Link
            href="/feed.xml"
            className="hover:text-gray-700 transition-colors dark:hover:text-gray-300"
          >
            RSS
          </Link>
          <Link
            href="/admin"
            className="hover:text-gray-700 transition-colors dark:hover:text-gray-300"
          >
            Admin
          </Link>
        </div>
      </div>
    </footer>
  );
}
