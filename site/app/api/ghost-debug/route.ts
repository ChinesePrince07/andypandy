import { getGhostAdminApiKey } from "@/lib/ghost";

// Temporary debug endpoint — visit this to see your Ghost Staff Access Token
export async function GET() {
  return Response.json({
    staff_access_token: getGhostAdminApiKey(),
    instructions: "Use this token in Ulysses as the Staff Access Token",
    test_url: "/ghost/api/admin/site/",
  });
}
