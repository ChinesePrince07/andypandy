import { verifyGhostAuth, ghostError, getSiteUrl } from "@/lib/ghost";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  if (!verifyGhostAuth(req)) return ghostError("Unauthorized", 401);

  return Response.json({
    site: {
      title: "Andy",
      description: "Personal site & blog",
      logo: null,
      icon: null,
      accent_color: "#000000",
      url: getSiteUrl(),
      version: "5.80.0",
    },
  });
}
