import { getSiteUrl } from "@/lib/ghost";

// Public endpoint — Ghost clients check this to verify it's a Ghost blog
export async function GET() {
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
