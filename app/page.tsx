import Link from "next/link";
import ScrambleText from "@/components/scramble-text";
import AboutEditor from "@/components/about-editor";
import { getAboutData } from "@/lib/about";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const LINKEDIN_URL = "https://www.linkedin.com/in/andy-zhang-3a280135a/";
const INSTAGRAM_URL = "https://www.instagram.com/andypandy0527/";
const EMAIL = "zhangandy4321@gmail.com";

const iconBtnClass =
  "inline-flex items-center justify-center h-10 w-10 rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition-all hover:border-gray-300 hover:text-gray-700 hover:shadow-md active:scale-95 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-300";

export default async function AboutPage() {
  const [about, admin] = await Promise.all([getAboutData(), isAdmin()]);

  return (
    <div className="space-y-12 animate-fade-in">
      {/* Status pill */}
      <div className="animate-fade-in" style={{ animationDelay: "100ms" }}>
        <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-500 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          Available for projects
        </span>
      </div>

      {/* Hero */}
      <div className="space-y-5" style={{ animationDelay: "200ms" }}>
        <h1
          className="text-5xl font-bold sm:text-6xl"
          style={{ letterSpacing: "-0.04em" }}
        >
          Hey, I&apos;m{" "}
          <ScrambleText
            text="Andy Zhang"
            className="gradient-text"
            interval={5000}
          />
        </h1>
        <p className="text-lg text-gray-500 leading-relaxed max-w-lg dark:text-gray-400">
          Developer, tinkerer, and builder of things — from embedded systems to
          full-stack web apps.
        </p>
      </div>

      {/* Divider */}
      <div className="divider" />

      {/* Bio */}
      <div
        className="space-y-4 text-gray-500 leading-relaxed animate-fade-in dark:text-gray-400"
        style={{ animationDelay: "300ms" }}
      >
        <div className="flex items-center">
          <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            About
          </h2>
        </div>
        {about.bio.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      {/* Links */}
      <div
        className="flex items-center gap-3 animate-fade-in"
        style={{ animationDelay: "400ms" }}
      >
        <a
          href="https://github.com/ChinesePrince07"
          target="_blank"
          rel="noopener noreferrer"
          className={iconBtnClass}
          aria-label="GitHub"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
        </a>
        <a
          href={LINKEDIN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={iconBtnClass}
          aria-label="LinkedIn"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
          </svg>
        </a>
        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={iconBtnClass}
          aria-label="Instagram"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
          </svg>
        </a>
        <a href={`mailto:${EMAIL}`} className={iconBtnClass} aria-label="Email">
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
            />
          </svg>
        </a>
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 shadow-sm transition-all hover:border-gray-300 hover:shadow-md active:scale-95 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-gray-600"
        >
          Read the blog &rarr;
        </Link>
      </div>

      {/* Divider */}
      <div className="divider" />

      {/* Education */}
      <section
        className="space-y-4 animate-fade-in"
        style={{ animationDelay: "500ms" }}
      >
        <div className="flex items-center">
          <h2 className="text-xl font-bold tracking-tight">Education</h2>
        </div>
        <div className="space-y-3">
          {about.education.map((entry) => (
            <div
              key={entry.school}
              className="rounded-xl border border-gray-200/80 bg-white p-5 shadow-sm dark:border-gray-800/80 dark:bg-gray-900"
            >
              <div className="flex items-center gap-4">
                {entry.logo ? (
                  <img
                    src={entry.logo}
                    alt={entry.school}
                    className="h-10 w-10 rounded-lg object-contain"
                  />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500">
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5"
                      />
                    </svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    {entry.school}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {entry.location}
                  </p>
                </div>
                <span className="shrink-0 text-xs tabular-nums text-gray-400 font-mono dark:text-gray-500">
                  {entry.year}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Admin editor */}
      {admin && <AboutEditor data={about} />}
    </div>
  );
}
