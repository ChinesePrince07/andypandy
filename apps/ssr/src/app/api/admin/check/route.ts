import { verifyAdmin } from '~/lib/admin-auth'

export async function GET() {
  const authenticated = await verifyAdmin()
  return Response.json({ authenticated })
}
