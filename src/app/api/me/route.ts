import { currentUser } from "@/lib/auth";
import { apiConfig, brixFetch } from "@/lib/brixhub";
import { readState } from "@/lib/state";

export const runtime = "nodejs";

export async function GET() {
  const user = await currentUser();
  const state = await readState();
  const config = apiConfig();
  const { response, json } = await brixFetch("/me");

  return Response.json({
    user,
    brix: json,
    brixStatus: {
      configured: Boolean(config.key),
      ok: response?.ok ?? false,
      status: response?.status ?? json.status ?? 500,
      message: json.message ?? null
    },
    rateLimit: {
      dayLimit: response?.headers.get("X-RateLimit-Limit-Day"),
      dayRemaining: response?.headers.get("X-RateLimit-Remaining-Day"),
      minuteLimit: response?.headers.get("X-RateLimit-Limit-Min")
    },
    state
  });
}
