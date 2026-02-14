// Minimal Ghost admin page — redirects editor URLs to actual blog posts
export async function GET() {
  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Ghost Admin</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script>
    // Redirect #/editor/post/<slug> to /blog/<slug>
    var hash = window.location.hash;
    var match = hash.match(/^#\/editor\/post\/(.+)/);
    if (match) {
      window.location.replace('/blog/' + match[1] + '/');
    }
  </script>
</head>
<body>
  <p>Redirecting to blog...</p>
</body>
</html>`,
    { headers: { "Content-Type": "text/html", "X-Ghost-Version": "5.80.0" } }
  );
}
