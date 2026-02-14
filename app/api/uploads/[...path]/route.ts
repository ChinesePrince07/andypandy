import { NextRequest } from "next/server";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const REPO = "ChinesePrince07/personal-site";

// Proxy images from private GitHub repo
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const filePath = `public/uploads/${path.join("/")}`;

  const res = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${filePath}`,
    {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        "User-Agent": "personal-site",
        Accept: "application/vnd.github.v3.raw",
      },
    }
  );

  if (!res.ok) {
    return new Response("Not found", { status: 404 });
  }

  const data = await res.arrayBuffer();
  const ext = path[path.length - 1]?.split(".").pop()?.toLowerCase();
  const contentType =
    ext === "png" ? "image/png" :
    ext === "gif" ? "image/gif" :
    ext === "webp" ? "image/webp" :
    ext === "svg" ? "image/svg+xml" :
    "image/jpeg";

  return new Response(data, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
