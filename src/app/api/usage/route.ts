import { brixFetch } from "@/lib/brixhub";
import { readState } from "@/lib/state";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get("limit") || "50";
  const offset = searchParams.get("offset") || "0";
  const state = await readState();
  const remote = await brixFetch(`/usage?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`);

  return Response.json({
    local: state.usage,
    remote: remote.json
  });
}
