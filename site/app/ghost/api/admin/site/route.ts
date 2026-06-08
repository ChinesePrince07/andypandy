import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const SITE_URL =
  process.env.SITE_URL ||
  "https://andypandy.org";

const GHOST_HEADERS = {
  "Content-Version": "v5.80",
  "X-Ghost-Version": "5.80.0",
};

export async function GET(req: NextRequest) {
  return Response.json(
    {
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
    },
    { headers: GHOST_HEADERS }
  );
}
