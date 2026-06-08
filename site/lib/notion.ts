// @ts-nocheck — Notion CMS integration (paused, will finish later)
import { Client } from "@notionhq/client";
import { NotionToMarkdown } from "notion-to-md";
import { marked } from "marked";
import type { Post } from "./blog";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const n2m = new NotionToMarkdown({ notionClient: notion });

const DATABASE_ID = process.env.NOTION_DATABASE_ID!;

function getPlainText(property: any): string {
  if (!property) return "";
  if (property.type === "title") {
    return property.title?.map((t: any) => t.plain_text).join("") || "";
  }
  if (property.type === "rich_text") {
    return property.rich_text?.map((t: any) => t.plain_text).join("") || "";
  }
  return "";
}

function getDate(property: any): string {
  if (!property || property.type !== "date" || !property.date) return "";
  return property.date.start || "";
}

function getCheckbox(property: any): boolean {
  if (!property || property.type !== "checkbox") return false;
  return property.checkbox === true;
}

export async function getAllNotionPosts(): Promise<Post[]> {
  const response = await notion.databases.query({
    database_id: DATABASE_ID,
    filter: {
      property: "Published",
      checkbox: { equals: true },
    },
    sorts: [{ property: "Date", direction: "descending" }],
  });

  const posts: Post[] = [];

  for (const page of response.results) {
    if (!("properties" in page)) continue;
    const props = page.properties;

    const title = getPlainText(props.Title || props.Name);
    const slug =
      getPlainText(props.Slug) ||
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    const date = getDate(props.Date);
    const description = getPlainText(props.Description);
    const pinned = getCheckbox(props.Pinned);

    posts.push({
      slug,
      title,
      date,
      description,
      content: "", // listing doesn't need full content
      pinned,
    });
  }

  return posts;
}

export async function getNotionPostBySlug(slug: string): Promise<Post | null> {
  const response = await notion.databases.query({
    database_id: DATABASE_ID,
    filter: {
      and: [
        { property: "Slug", rich_text: { equals: slug } },
        { property: "Published", checkbox: { equals: true } },
      ],
    },
  });

  const page = response.results[0];
  if (!page || !("properties" in page)) return null;

  const props = page.properties;
  const title = getPlainText(props.Title || props.Name);
  const date = getDate(props.Date);
  const description = getPlainText(props.Description);

  // Convert Notion blocks to markdown, then to HTML
  const mdBlocks = await n2m.pageToMarkdown(page.id);
  const mdString = n2m.toMarkdownString(mdBlocks).parent;

  const renderer = new marked.Renderer();
  renderer.image = ({ href, title: imgTitle, text }) => {
    const alt = text ? ` alt="${text}"` : "";
    const t = imgTitle ? ` title="${imgTitle}"` : "";
    return `<img src="${href}"${alt}${t} style="max-width: 50%; height: auto;" />`;
  };

  const content = await marked(mdString, {
    gfm: true,
    breaks: false,
    renderer,
  });

  return {
    slug,
    title,
    date,
    description,
    content,
  };
}
