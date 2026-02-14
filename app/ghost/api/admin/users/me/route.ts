import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  console.log("GHOST /users/me/ HIT", {
    auth: req.headers.get("authorization")?.slice(0, 30),
    accept: req.headers.get("accept-version"),
  });

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
