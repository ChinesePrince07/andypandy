import { getSiteUrl } from "@/lib/ghost";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

// Public endpoint — Ghost clients check this to verify it's a Ghost blog
export async function GET(req: NextRequest) {
  console.log("GHOST /site/ HIT", {
    ua: req.headers.get("user-agent")?.slice(0, 50),
    auth: req.headers.get("authorization")?.slice(0, 30),
  });

  return Response.json({
    site: {
      title: "Andy",
      description: "Personal site & blog",
      logo: null,
      icon: null,
      accent_color: "#000000",
      locale: "en",
      url: getSiteUrl(),
      version: "5.80.0",
    },
  });
}
