import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Projects",
};

const projects = [
  {
    name: "TI-84 GPT Hack",
    slug: "ti-84-gpt-hack",
    description:
      "A mod that gives your TI-84 Wi-Fi, ChatGPT, and the ability to disappoint your math teacher in ways never thought possible.",
    tags: ["C", "ESP32", "Hardware"],
    emoji: "🧮",
  },
  {
    name: "Desmos Bezier Renderer",
    slug: "desmos-bezier-renderer",
    description:
      "Transform any image into mathematical art on Desmos. Uses Canny edge detection and Potrace to convert images into parametric Bezier curve equations.",
    tags: ["HTML", "Math", "macOS"],
    emoji: "📐",
    demo: "https://desmos.andypandy.org/calculator",
  },
  {
    name: "Suffield Drive",
    slug: "suffield-drive",
    description:
      "A shared drive for Suffield students to access and share school resources.",
    tags: ["TypeScript", "Web"],
    emoji: "☁️",
    demo: "https://suffield-drive.vercel.app",
  },
  {
    name: "EXIF Photo Blog",
    slug: "exif-photo-blog",
    description:
      "A photography blog that reports camera details like aperture, shutter speed, and ISO for each image.",
    tags: ["TypeScript", "Next.js", "Photography"],
    emoji: "📷",
    demo: "https://exif-photo-blog-real.vercel.app",
  },
  {
    name: "Taylor Series Visualizer",
    slug: "taylor-series",
    description:
      "An interactive visualization of Taylor series approximations for Calc BC.",
    tags: ["HTML", "Math"],
    emoji: "📊",
    demo: "https://taylorseries-calcbc.vercel.app",
  },
  {
    name: "Music Landing Page",
    slug: "music-landing-page",
    description:
      "A commissioned landing page for a music artist.",
    tags: ["HTML", "Design"],
    emoji: "🎵",
    demo: "https://music-landing-page-commissioned.vercel.app",
  },
  {
    name: "Stroke Prediction",
    slug: "stroke-prediction",
    description:
      "ML model that predicts stroke likelihood based on patient data like age, BMI, glucose level, and smoking status.",
    tags: ["Python", "ML", "Jupyter"],
    emoji: "🧠",
  },
  {
    name: "Chatbot UI",
    slug: "chatbot-ui",
    description:
      "A chat interface for interacting with AI models.",
    tags: ["TypeScript", "AI"],
    emoji: "💬",
    demo: "https://chatbot-ui-phi-one-74.vercel.app",
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
            href={`/projects/${project.slug}`}
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
