import { revalidateTag } from "next/cache";
import { isAdminRequest } from "@/lib/admin-auth";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const REPO = "ChinesePrince07/personal-site";
const CONFIG_PATH = "content/pinned-projects.json";

async function getFileData(): Promise<{ sha: string; slugs: string[] } | null> {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${CONFIG_PATH}`,
    {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        "User-Agent": "personal-site",
        Accept: "application/vnd.github.v3+json",
      },
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const decoded = Buffer.from(data.content, "base64").toString("utf8");
  return { sha: data.sha, slugs: JSON.parse(decoded) };
}

// POST — toggle pin for a project
export async function POST(req: Request) {
  if (!(await isAdminRequest(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug, pinned } = await req.json();
  if (!slug) {
    return Response.json({ error: "Missing slug" }, { status: 400 });
  }

  const existing = await getFileData();
  let currentSlugs = existing?.slugs ?? [];

  if (pinned) {
    if (!currentSlugs.includes(slug)) {
      currentSlugs.push(slug);
    }
  } else {
    currentSlugs = currentSlugs.filter((s) => s !== slug);
  }

  const body: Record<string, string> = {
    message: `projects: ${pinned ? "pin" : "unpin"} ${slug}`,
    content: Buffer.from(JSON.stringify(currentSlugs, null, 2)).toString("base64"),
  };
  if (existing?.sha) body.sha = existing.sha;

  const res = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${CONFIG_PATH}`,
    {
      method: "PUT",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
        "User-Agent": "personal-site",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    return Response.json({ error: err }, { status: 502 });
  }

  revalidateTag("pinned-projects");
  return Response.json({ ok: true });
}
