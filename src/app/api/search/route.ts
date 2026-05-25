import { brixFetch } from "@/lib/brixhub";
import { addUsage } from "@/lib/state";
import { parsePrompt, queryLabel, sanitizeSearchBody } from "@/lib/query";

export const runtime = "nodejs";

type SearchRequest = {
  prompt?: string;
  body?: Record<string, unknown>;
};

export async function POST(request: Request) {
  const input = (await request.json()) as SearchRequest;
  const searchBody = input.body ? sanitizeSearchBody(input.body) : parsePrompt(input.prompt || "");
  const label = queryLabel(searchBody) || "recherche";

  const hasCriteria = Object.keys(searchBody).some((key) => !["page", "per_page", "flexible"].includes(key));
  if (!hasCriteria) {
    return Response.json({ message: "Ajoutez au moins un critere de recherche" }, { status: 400 });
  }

  const { response, json } = await brixFetch("/search", {
    method: "POST",
    body: JSON.stringify(searchBody)
  });

  const status = response?.status || json.status || 500;

  await addUsage({
    endpoint: "/search",
    status,
    queryLabel: label,
    localRemaining: 0
  });

  return Response.json({
    result: json,
    query: searchBody,
    rateLimit: {
      dayLimit: response?.headers.get("X-RateLimit-Limit-Day"),
      dayRemaining: response?.headers.get("X-RateLimit-Remaining-Day"),
      minuteLimit: response?.headers.get("X-RateLimit-Limit-Min")
    }
  });
}
