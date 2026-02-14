import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const GHOST_HEADERS = {
  "Content-Version": "v5.80",
  "X-Ghost-Version": "5.80.0",
};

function ghostError(message: string, status: number) {
  return Response.json(
    { errors: [{ message, type: "UnauthorizedError" }] },
    { status, headers: GHOST_HEADERS }
  );
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const REPO = "ChinesePrince07/personal-site";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return ghostError("No file uploaded", 422);

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `public/uploads/${safeName}`;

    const commitBody: Record<string, string> = {
      message: `upload: ${safeName}`,
      content: base64,
    };

    const existing = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${path}`,
      {
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          "User-Agent": "personal-site",
        },
      }
    );
    if (existing.ok) {
      const data = await existing.json();
      commitBody.sha = data.sha;
    }

    const res = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${path}`,
      {
        method: "PUT",
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          "Content-Type": "application/json",
          "User-Agent": "personal-site",
        },
        body: JSON.stringify(commitBody),
      }
    );

    if (!res.ok) return ghostError("Failed to upload", 502);

    // Use GitHub raw URL — immediately available, no redeploy needed
    const imageUrl = `https://raw.githubusercontent.com/${REPO}/main/${path}`;

    return Response.json(
      {
        images: [{ url: imageUrl, ref: null }],
      },
      { headers: GHOST_HEADERS }
    );
  } catch (err) {
    return ghostError(String(err), 500);
  }
}
