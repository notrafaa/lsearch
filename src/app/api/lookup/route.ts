import { brixFetch } from "@/lib/brixhub";
import { addUsage, readState, updateState } from "@/lib/state";

export const runtime = "nodejs";

const lookupTypes = new Set(["email", "phone", "iban"]);

export async function POST(request: Request) {
  const { type, value } = (await request.json()) as { type?: string; value?: string };
  if (!type || !lookupTypes.has(type) || !value) {
    return Response.json({ message: "Lookup invalide" }, { status: 400 });
  }

  const state = await readState();
  const label = `${type}:${value}`;

  if (state.localQuota.used >= state.localQuota.dailyLimit) {
    return Response.json({ message: "Quota local journalier atteint" }, { status: 429 });
  }

  const { response, json } = await brixFetch(`/lookup/${type}/${encodeURIComponent(value)}`);
  const status = response?.status || json.status || 500;

  const nextState = await updateState((draft) => {
    if (status < 500) {
      draft.localQuota.used += 1;
    }
  });

  await addUsage({
    endpoint: `/lookup/${type}`,
    status,
    queryLabel: label,
    localRemaining: Math.max(0, nextState.localQuota.dailyLimit - nextState.localQuota.used)
  });

  return Response.json({
    result: json,
    rateLimit: {
      dayLimit: response?.headers.get("X-RateLimit-Limit-Day"),
      dayRemaining: response?.headers.get("X-RateLimit-Remaining-Day"),
      minuteLimit: response?.headers.get("X-RateLimit-Limit-Min")
    },
    localQuota: nextState.localQuota
  });
}
