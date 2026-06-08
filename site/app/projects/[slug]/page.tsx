import { notFound } from "next/navigation";
import Link from "next/link";
import { projects } from "@/lib/projects";

export const dynamic = "force-dynamic";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;

async function getReadmeHtml(repo: string): Promise<string | null> {
  const headers = {
    Authorization: `token ${GITHUB_TOKEN}`,
    "User-Agent": "personal-site",
  };

  // Get default branch
  const repoRes = await fetch(`https://api.github.com/repos/${repo}`, {
    headers: { ...headers, Accept: "application/vnd.github.v3+json" },
    next: { revalidate: 86400 },
  });
  const branch = repoRes.ok ? (await repoRes.json()).default_branch : "main";

  // Get rendered HTML directly from GitHub API
  const res = await fetch(`https://api.github.com/repos/${repo}/readme`, {
    headers: { ...headers, Accept: "application/vnd.github.v3.html" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  let html = await res.text();

  // Remove GitHub heading anchor links (octicon SVG permalink icons)
  html = html.replace(/<a[^>]*class="anchor"[^>]*>[\s\S]*?<\/a>/g, "");

  // Unwrap markdown-heading divs (GitHub wraps headings in <div class="markdown-heading">)
  html = html.replace(/<div[^>]*class="markdown-heading"[^>]*>\s*/g, "");
  html = html.replace(/\s*<\/div>\s*(?=<h[1-6]|$)/g, "");

  // Remove outer GitHub wrapper elements
  html = html.replace(/<article[^>]*class="markdown-body[^"]*"[^>]*>/g, "");
  html = html.replace(/<\/article>/g, "");
  html = html.replace(/<div[^>]*id="readme"[^>]*>/g, "");

  // Unwrap images from link wrappers (GitHub wraps <img> in <a> pointing to the file)
  html = html.replace(
    /<a[^>]*href="[^"]*"[^>]*>\s*(<img[^>]*>)\s*<\/a>/g,
    "$1"
  );

  // Rewrite relative image src to raw GitHub URLs (handle ./ and / prefixes)
  html = html.replace(
    /src="(?!https?:\/\/)(?:\.\/)?\/?([^"]+)"/g,
    `src="https://raw.githubusercontent.com/${repo}/${branch}/$1"`
  );

  return html;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = projects.find((p) => p.slug === slug);
  if (!project) return {};
  return { title: project.name };
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = projects.find((p) => p.slug === slug);
  if (!project) notFound();

  const htmlContent = await getReadmeHtml(project.repo);

  return (
    <div className="animate-fade-in">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
      >
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
          />
        </svg>
        Back to projects
      </Link>

      <header className="mt-8 space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{project.emoji}</span>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {project.name}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {project.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400"
            >
              {tag}
            </span>
          ))}
          <a
            href={`https://github.com/${project.repo}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            Source
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
          </a>
          {project.demo && (
            <a
              href={project.demo}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            >
              Live Demo
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
              </svg>
            </a>
          )}
        </div>
      </header>

      <div className="my-8 divider" />

      {htmlContent ? (
        <div
          className="prose max-w-none"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      ) : (
        <p className="text-gray-400 dark:text-gray-500">No README found for this project.</p>
      )}
    </div>
  );
}
