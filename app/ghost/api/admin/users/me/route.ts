import { verifyGhostAuth, ghostError } from "@/lib/ghost";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  if (!verifyGhostAuth(req)) return ghostError("Unauthorized", 401);

  return Response.json({
    users: [
      {
        id: "1",
        name: "Andy",
        slug: "andy",
        email: "admin@example.com",
        profile_image: null,
        bio: null,
        website: null,
        location: null,
        accessibility: null,
        status: "active",
        tour: null,
        roles: [
          {
            id: "1",
            name: "Owner",
            description: "Blog Owner",
          },
        ],
      },
    ],
  });
}
