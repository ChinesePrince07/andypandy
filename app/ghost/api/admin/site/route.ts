import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const SITE_URL =
  process.env.SITE_URL ||
  "https://personal-site-andy-zhangs-projects.vercel.app";

// Public endpoint — Ghost clients check this to verify it's a Ghost blog
export async function GET(req: NextRequest) {
  try {
    return Response.json({
      site: {
        title: "Andy",
        description: "Personal site & blog",
        logo: null,
        icon: null,
        accent_color: "#000000",
        locale: "en",
        url: SITE_URL,
        version: "5.80.0",
      },
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
