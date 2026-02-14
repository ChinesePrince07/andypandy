import type { Metadata } from "next";
import Link from "next/link";
import { getProjectsWithPins } from "@/lib/projects";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Projects",
};

export default async function ProjectsPage() {
  const projects = await getProjectsWithPins();

  return (
    <div className="space-y-10">
      <div className="animate-fade-in">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Projects
        </h1>
        <p className="mt-3 text-gray-500 dark:text-gray-400">
          A collection of things I&apos;ve built and worked on.
        </p>
      </div>

      <div className="stagger space-y-4">
        {projects.map((project) => (
          <Link
            key={project.name}
            href={`/projects/${project.slug}`}
            className="card-hover group block rounded-xl border border-gray-200/80 bg-white p-5 shadow-sm dark:border-gray-800/80 dark:bg-gray-900"
          >
            <div className="flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-lg transition-transform group-hover:scale-110 dark:bg-gray-800">
                {project.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {project.pinned && (
                    <span className="pinned-badge shrink-0">
                      <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.75V16.5L12 14.25 7.5 16.5V3.75m9 0H18A2.25 2.25 0 0120.25 6v12A2.25 2.25 0 0118 20.25H6A2.25 2.25 0 013.75 18V6A2.25 2.25 0 016 3.75h1.5m9 0h-9" />
                      </svg>
                      Pinned
                    </span>
                  )}
                  <h2 className="font-semibold text-gray-900 group-hover:gradient-text transition-colors dark:text-gray-100">
                    {project.name}
                  </h2>
                  <svg
                    className="h-3.5 w-3.5 text-gray-300 transition-all group-hover:text-gray-500 group-hover:translate-x-0.5 dark:text-gray-600 dark:group-hover:text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                    />
                  </svg>
                </div>
                <p className="mt-1 text-sm text-gray-500 leading-relaxed dark:text-gray-400">
                  {project.description}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {project.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                    >
                      {tag}
                    </span>
                  ))}
                  {project.demo && (
                    <a
                      href={project.demo}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-1 inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-0.5 text-xs font-medium text-gray-400 transition-colors hover:border-gray-300 hover:text-gray-600 dark:border-gray-700 dark:text-gray-500 dark:hover:border-gray-600 dark:hover:text-gray-300"
                    >
                      Live Demo
                      <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
