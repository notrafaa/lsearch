import { brixFetch } from "@/lib/brixhub";
import { addUsage } from "@/lib/state";

export const runtime = "nodejs";

const lookupTypes = new Set(["email", "phone", "iban"]);

export async function POST(request: Request) {
  const { type, value } = (await request.json()) as { type?: string; value?: string };
  if (!type || !lookupTypes.has(type) || !value) {
    return Response.json({ message: "Lookup invalide" }, { status: 400 });
  }

  const label = `${type}:${value}`;

  const { response, json } = await brixFetch(`/lookup/${type}/${encodeURIComponent(value)}`);
  const status = response?.status || json.status || 500;

  await addUsage({
    endpoint: `/lookup/${type}`,
    status,
    queryLabel: label,
    localRemaining: 0
  });

  return Response.json({
    result: json,
    rateLimit: {
      dayLimit: response?.headers.get("X-RateLimit-Limit-Day"),
      dayRemaining: response?.headers.get("X-RateLimit-Remaining-Day"),
      minuteLimit: response?.headers.get("X-RateLimit-Limit-Min")
    }
  });
}
