import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const GHOST_HEADERS = {
  "Content-Version": "v5.80",
  "X-Ghost-Version": "5.80.0",
};

export async function GET(req: NextRequest) {
  return Response.json(
    {
      users: [
        {
          id: "1",
          name: "Andy Zhang",
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
    },
    { headers: GHOST_HEADERS }
  );
}
