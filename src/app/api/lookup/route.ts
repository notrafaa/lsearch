import { brixFetch } from "@/lib/brixhub";
import { addUsage, blacklistHit, readState, updateState } from "@/lib/state";

export const runtime = "nodejs";

const lookupTypes = new Set(["email", "phone", "iban"]);

export async function POST(request: Request) {
  const { type, value } = (await request.json()) as { type?: string; value?: string };
  if (!type || !lookupTypes.has(type) || !value) {
    return Response.json({ message: "Lookup invalide" }, { status: 400 });
  }

  const state = await readState();
  const label = `${type}:${value}`;
  const queryBlockedBy = blacklistHit({ type, value }, state.blacklist);
  if (queryBlockedBy) {
    await addUsage({
      endpoint: `/lookup/${type}`,
      status: 0,
      queryLabel: label,
      blocked: true,
      localRemaining: Math.max(0, state.localQuota.dailyLimit - state.localQuota.used)
    });
    return Response.json({
      blocked: true,
      reason: `Lookup bloque par la blacklist: ${queryBlockedBy}`
    });
  }

  if (state.localQuota.used >= state.localQuota.dailyLimit) {
    return Response.json({ message: "Quota local journalier atteint" }, { status: 429 });
  }

  const { response, json } = await brixFetch(`/lookup/${type}/${encodeURIComponent(value)}`);
  const responseBlockedBy = blacklistHit(json, state.blacklist);
  const status = response?.status || json.status || 500;

  const nextState = await updateState((draft) => {
    if (!responseBlockedBy && status < 500) {
      draft.localQuota.used += 1;
    }
  });

  await addUsage({
    endpoint: `/lookup/${type}`,
    status,
    queryLabel: label,
    blocked: Boolean(responseBlockedBy),
    localRemaining: Math.max(0, nextState.localQuota.dailyLimit - nextState.localQuota.used)
  });

  if (responseBlockedBy) {
    return Response.json({
      blocked: true,
      reason: `Resultat masque car il contient une entree blacklist: ${responseBlockedBy}`
    });
  }

  return Response.json({
    blocked: false,
    result: json,
    rateLimit: {
      dayLimit: response?.headers.get("X-RateLimit-Limit-Day"),
      dayRemaining: response?.headers.get("X-RateLimit-Remaining-Day"),
      minuteLimit: response?.headers.get("X-RateLimit-Limit-Min")
    },
    localQuota: nextState.localQuota
  });
}
