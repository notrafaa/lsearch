import { updateState } from "@/lib/state";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    dailyLimit?: number;
  };

  const state = await updateState((draft) => {
    if (typeof body.dailyLimit === "number" && body.dailyLimit > 0) {
      draft.localQuota.dailyLimit = Math.floor(body.dailyLimit);
    }
  });

  return Response.json({ state });
}
