import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Projects",
};

const projects = [
  {
    name: "TI-32",
    description:
      "An ESP32-powered add-on for the TI-84 calculator that adds AI capabilities, WiFi, and more.",
    url: "https://github.com/andypandy/Ti-84-yeet",
    tags: ["ESP32", "C++", "Hardware"],
    emoji: "🧮",
  },
  {
    name: "Cloud Drive",
    description: "A self-hosted cloud storage solution.",
    url: "https://github.com/andypandy/cloud-drive",
    tags: ["Web", "Storage"],
    emoji: "☁️",
  },
  {
    name: "Desmos Bezier Renderer",
    description:
      "Render images as Bezier curves in Desmos graphing calculator.",
    url: "https://github.com/andypandy/DesmosBezierRenderer-mac",
    tags: ["Python", "Math"],
    emoji: "📐",
  },
  {
    name: "Prank Trading Site",
    description: "A fake stock trading platform for pranking friends.",
    url: "https://github.com/andypandy/prank-trading-site",
    tags: ["Web", "Fun"],
    emoji: "📈",
  },
  {
    name: "Photo Blog",
    description: "An EXIF-powered photography portfolio and blog.",
    url: "https://github.com/andypandy/exif-photo-blog",
    tags: ["Next.js", "Photography"],
    emoji: "📷",
  },
];

export default function ProjectsPage() {
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
            href={project.url}
            target="_blank"
            rel="noopener noreferrer"
            className="card-hover group block rounded-xl border border-gray-200/80 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-lg transition-transform group-hover:scale-110">
                {project.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
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
                      d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25"
                    />
                  </svg>
                </div>
                <p className="mt-1 text-sm text-gray-500 leading-relaxed">
                  {project.description}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {project.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
