// Minimal Ghost admin page — enough for clients to detect Ghost
export async function GET() {
  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Ghost Admin</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
  <p>Ghost Admin</p>
</body>
</html>`,
    { headers: { "Content-Type": "text/html", "X-Ghost-Version": "5.80.0" } }
  );
}
