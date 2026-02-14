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
        <p className="mt-3 text-gray-500">
          A collection of things I&apos;ve built and worked on.
        </p>
      </div>

      <div className="stagger space-y-4">
        {projects.map((project) => (
          <Link
            key={project.name}
            href={`/projects/${project.slug}`}
            className="card-hover group block rounded-xl border border-gray-200/80 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-lg transition-transform group-hover:scale-110">
                {project.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {project.pinned && (
                    <span className="h-1.5 w-1.5 rounded-full bg-gray-900 shrink-0" />
                  )}
                  <h2 className="font-semibold text-gray-900 group-hover:gradient-text transition-colors">
                    {project.name}
                  </h2>
                  <svg
                    className="h-3.5 w-3.5 text-gray-300 transition-all group-hover:text-gray-500 group-hover:translate-x-0.5"
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
                <p className="mt-1 text-sm text-gray-500 leading-relaxed">
                  {project.description}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {project.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500"
                    >
                      {tag}
                    </span>
                  ))}
                  {project.demo && (
                    <a
                      href={project.demo}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-1 inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-0.5 text-xs font-medium text-gray-400 transition-colors hover:border-gray-300 hover:text-gray-600"
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
