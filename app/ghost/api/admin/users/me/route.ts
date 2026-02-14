import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    console.log("GHOST /users/me/ auth:", req.headers.get("authorization")?.slice(0, 40));

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
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
