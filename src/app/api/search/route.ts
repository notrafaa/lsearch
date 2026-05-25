import { brixFetch } from "@/lib/brixhub";
import { readState, updateState, addUsage } from "@/lib/state";
import { parsePrompt, queryLabel, sanitizeSearchBody } from "@/lib/query";

export const runtime = "nodejs";

type SearchRequest = {
  prompt?: string;
  body?: Record<string, unknown>;
};

export async function POST(request: Request) {
  const input = (await request.json()) as SearchRequest;
  const searchBody = input.body ? sanitizeSearchBody(input.body) : parsePrompt(input.prompt || "");
  const state = await readState();
  const label = queryLabel(searchBody) || "recherche";

  const hasCriteria = Object.keys(searchBody).some((key) => !["page", "per_page", "flexible"].includes(key));
  if (!hasCriteria) {
    return Response.json({ message: "Ajoutez au moins un critere de recherche" }, { status: 400 });
  }

  if (state.localQuota.used >= state.localQuota.dailyLimit) {
    return Response.json({ message: "Quota local journalier atteint" }, { status: 429 });
  }

  const { response, json } = await brixFetch("/search", {
    method: "POST",
    body: JSON.stringify(searchBody)
  });

  const status = response?.status || json.status || 500;

  const nextState = await updateState((draft) => {
    if (status < 500) {
      draft.localQuota.used += 1;
    }
  });

  await addUsage({
    endpoint: "/search",
    status,
    queryLabel: label,
    localRemaining: Math.max(0, nextState.localQuota.dailyLimit - nextState.localQuota.used)
  });

  return Response.json({
    result: json,
    query: searchBody,
    rateLimit: {
      dayLimit: response?.headers.get("X-RateLimit-Limit-Day"),
      dayRemaining: response?.headers.get("X-RateLimit-Remaining-Day"),
      minuteLimit: response?.headers.get("X-RateLimit-Limit-Min")
    },
    localQuota: nextState.localQuota
  });
}
