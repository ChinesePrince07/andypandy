/**
 * Convert Ghost/Ulysses HTML to markdown.
 * Handles: strong, em, links, images, headings, lists, blockquotes,
 * figures, line breaks, paragraphs.
 */
export function htmlToMarkdown(html: string): string {
  if (!html || (!html.includes("<") && !html.includes("&"))) return html;

  let md = html;

  // Headings
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "# $1\n\n");
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "## $1\n\n");
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "### $1\n\n");
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "#### $1\n\n");

  // Images (before links to avoid conflict)
  md = md.replace(/<img[^>]+src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, "![$2]($1)");
  md = md.replace(/<img[^>]+src="([^"]*)"[^>]*\/?>/gi, "![]($1)");

  // Figure/figcaption
  md = md.replace(/<figure[^>]*>([\s\S]*?)<\/figure>/gi, "$1\n");
  md = md.replace(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/gi, "*$1*\n");

  // Links
  md = md.replace(/<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)");

  // Bold / italic
  md = md.replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, "**$2**");
  md = md.replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, "*$2*");

  // Strikethrough
  md = md.replace(/<(del|s|strike)>([\s\S]*?)<\/\1>/gi, "~~$2~~");

  // Code
  md = md.replace(/<code>([\s\S]*?)<\/code>/gi, "`$1`");
  md = md.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, "```\n$1\n```\n");

  // Blockquote
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, inner) => {
    return inner.replace(/<[^>]*>/g, "").split("\n").map((l: string) => `> ${l}`).join("\n") + "\n\n";
  });

  // Lists
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, inner) => {
    return `- ${inner.replace(/<[^>]*>/g, "").trim()}\n`;
  });
  md = md.replace(/<\/?[ou]l[^>]*>/gi, "\n");

  // Line breaks and paragraphs
  md = md.replace(/<br\s*\/?>/gi, "\n");
  md = md.replace(/<\/p>\s*<p[^>]*>/gi, "\n\n");

  // HR
  md = md.replace(/<hr\s*\/?>/gi, "\n---\n");

  // Strip remaining tags
  md = md.replace(/<[^>]*>/g, "");

  // Decode HTML entities
  md = md
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");

  // Clean up extra blank lines
  md = md.replace(/\n{3,}/g, "\n\n");

  return md.trim();
}
