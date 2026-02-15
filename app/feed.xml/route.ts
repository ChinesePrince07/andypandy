import RSS from "rss";
import { getAllPosts } from "@/lib/blog";

const SITE_URL = "https://andypandy.org";

export async function GET() {
  const posts = await getAllPosts();

  const feed = new RSS({
    title: "Andy's Blog",
    description: "Thoughts, tutorials, and updates",
    site_url: SITE_URL,
    feed_url: `${SITE_URL}/feed.xml`,
    language: "en",
  });

  for (const post of posts) {
    feed.item({
      title: post.title,
      description: post.description,
      url: `${SITE_URL}/blog/${post.slug}`,
      date: post.date,
    });
  }

  return new Response(feed.xml({ indent: true }), {
    headers: {
      "Content-Type": "application/xml",
    },
  });
}
