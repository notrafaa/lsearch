import { currentUser } from "@/lib/auth";
import { brixFetch } from "@/lib/brixhub";
import { readState } from "@/lib/state";

export const runtime = "nodejs";

export async function GET() {
  const user = await currentUser();
  const state = await readState();
  const { response, json } = await brixFetch("/me");

  return Response.json({
    user,
    brix: json,
    rateLimit: {
      dayLimit: response?.headers.get("X-RateLimit-Limit-Day"),
      dayRemaining: response?.headers.get("X-RateLimit-Remaining-Day"),
      minuteLimit: response?.headers.get("X-RateLimit-Limit-Min")
    },
    state
  });
}
