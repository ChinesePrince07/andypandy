import { NextResponse } from "next/server";

const SITE_URL =
  process.env.SITE_URL || "https://andypandy.org";

// WordPress REST API discovery endpoint
export async function GET() {
  return NextResponse.json({
    name: "Andy Zhang",
    description: "Personal site & blog",
    url: SITE_URL,
    home: SITE_URL,
    namespaces: ["wp/v2"],
    authentication: {
      "application-passwords": {
        endpoints: {
          authorization: `${SITE_URL}/wp-admin/authorize-application.php`,
        },
      },
    },
    routes: {
      "/wp/v2/posts": {
        methods: ["GET", "POST"],
        endpoints: [{ methods: ["GET", "POST"] }],
      },
    },
  });
}
