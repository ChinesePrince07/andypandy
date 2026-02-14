import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;

const projects = [
  { slug: "ti-84-gpt-hack", repo: "ChinesePrince07/TI-84-GPT-HACK", name: "TI-84 GPT Hack", tags: ["C", "ESP32", "Hardware"], emoji: "🧮" },
  { slug: "desmos-bezier-renderer", repo: "ChinesePrince07/DesmosBezierRenderer-mac", name: "Desmos Bezier Renderer", tags: ["HTML", "Math", "macOS"], emoji: "📐" },
  { slug: "suffield-drive", repo: "ChinesePrince07/Suffield-Drive", name: "Suffield Drive", tags: ["TypeScript", "Web"], emoji: "☁️" },
  { slug: "exif-photo-blog", repo: "ChinesePrince07/exif-photo-blog-real", name: "EXIF Photo Blog", tags: ["TypeScript", "Next.js", "Photography"], emoji: "📷" },
  { slug: "taylor-series", repo: "ChinesePrince07/taylorseries-CALCBC", name: "Taylor Series Visualizer", tags: ["HTML", "Math"], emoji: "📊" },
  { slug: "music-landing-page", repo: "ChinesePrince07/music-landing-page-commissioned", name: "Music Landing Page", tags: ["HTML", "Design"], emoji: "🎵" },
  { slug: "stroke-prediction", repo: "ChinesePrince07/Stroke-Prediction", name: "Stroke Prediction", tags: ["Python", "ML", "Jupyter"], emoji: "🧠" },
  { slug: "chatbot-ui", repo: "ChinesePrince07/chatbot-ui", name: "Chatbot UI", tags: ["TypeScript", "AI"], emoji: "💬" },
];

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
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-gray-600"
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
              className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500"
            >
              {tag}
            </span>
          ))}
          <a
            href={`https://github.com/${project.repo}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
          >
            View on GitHub
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
            </svg>
          </a>
        </div>
      </header>

      <div className="my-8 h-px bg-gradient-to-r from-gray-200 via-gray-300 to-transparent" />

      {htmlContent ? (
        <div
          className="prose max-w-none"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      ) : (
        <p className="text-gray-400">No README found for this project.</p>
      )}
    </div>
  );
}
