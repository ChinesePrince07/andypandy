/**
 * Convert Ghost/Ulysses HTML to markdown.
 *
 * Ulysses markup → HTML → Markdown mapping:
 *   _Emphasize_       → <em>         → *text*
 *   **Strong**        → <strong>     → **text**
 *   ::Highlight::     → <mark>       → <mark>text</mark>  (kept as HTML)
 *   [Redact||         → <del>        → ~~text~~
 *   (img)             → <img>        → ![alt](url)
 *   (vid)             → <video>      → <video> (kept as HTML)
 *   (fn)              → footnote sup → kept as HTML
 *   $ Equation        → math span    → kept as HTML
 *   ++Comment++       → stripped by Ulysses before publish
 *   'Code'            → <code>       → `code`
 *   ~Raw Source~      → raw HTML     → kept as-is
 */
export function htmlToMarkdown(html: string): string {
  if (!html || (!html.includes("<") && !html.includes("&"))) return html;

  let md = html;

  // --- Block-level conversions ---

  // Headings
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n\n");
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n\n");
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n\n");
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "\n#### $1\n\n");
  md = md.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, "\n##### $1\n\n");
  md = md.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, "\n###### $1\n\n");

  // Pre/code blocks (before inline code)
  md = md.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, "\n```\n$1\n```\n");
  md = md.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, "\n```\n$1\n```\n");

  // Blockquote
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_match, inner: string) => {
    const cleaned = inner.replace(/<\/?p[^>]*>/gi, "").trim();
    return "\n" + cleaned.split("\n").map((l: string) => `> ${l.trim()}`).join("\n") + "\n\n";
  });

  // HR
  md = md.replace(/<hr\s*\/?>/gi, "\n---\n");

  // --- Images (before links to avoid nested match) ---
  md = md.replace(/<img[^>]+src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, "![$2]($1)");
  md = md.replace(/<img[^>]+alt="([^"]*)"[^>]*src="([^"]*)"[^>]*\/?>/gi, "![$1]($2)");
  md = md.replace(/<img[^>]+src="([^"]*)"[^>]*\/?>/gi, "![]($1)");

  // Figure/figcaption
  md = md.replace(/<figure[^>]*>([\s\S]*?)<\/figure>/gi, "\n$1\n");
  md = md.replace(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/gi, "*$1*\n");

  // --- Inline conversions ---

  // Links
  md = md.replace(/<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)");

  // Bold / italic (handle nested: bold-italic)
  md = md.replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, "**$2**");
  md = md.replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, "*$2*");

  // Strikethrough / redact
  md = md.replace(/<(del|s|strike)>([\s\S]*?)<\/\1>/gi, "~~$2~~");

  // Inline code
  md = md.replace(/<code>([\s\S]*?)<\/code>/gi, "`$1`");

  // --- Lists ---
  // Ordered lists: convert <li> inside <ol> to numbered items
  md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_match, inner: string) => {
    let i = 0;
    return "\n" + inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m: string, li: string) => {
      i++;
      return `${i}. ${li.replace(/<[^>]*>/g, "").trim()}\n`;
    }) + "\n";
  });

  // Unordered lists
  md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_match, inner: string) => {
    return "\n" + inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m: string, li: string) => {
      return `- ${li.replace(/<[^>]*>/g, "").trim()}\n`;
    }) + "\n";
  });

  // --- Elements kept as raw HTML (no markdown equivalent) ---
  // <mark>, <video>, <iframe>, <audio>, <sup>, <sub>, <table>,
  // <math>, <span class="math">, footnote divs — all preserved

  // --- Structural tags to remove ---
  // Line breaks
  md = md.replace(/<br\s*\/?>/gi, "\n");

  // Paragraphs
  md = md.replace(/<\/p>\s*<p[^>]*>/gi, "\n\n");
  md = md.replace(/<p[^>]*>/gi, "");
  md = md.replace(/<\/p>/gi, "\n\n");

  // Remove only structural/wrapper tags, keep meaningful ones
  md = md.replace(/<\/?(div|section|article|header|footer|main|nav|aside|span)(\s[^>]*)?>/gi, "");

  // --- Decode HTML entities ---
  md = md
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "...");

  // Clean up excessive blank lines
  md = md.replace(/\n{3,}/g, "\n\n");

  return md.trim();
}
