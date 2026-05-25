import { addSavedSearch, updateState } from "@/lib/state";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    label?: string;
    kind?: "search" | "lookup";
    searchBody?: Record<string, unknown>;
  };

  if (!body.label || !body.kind || !body.searchBody) {
    return Response.json({ message: "Recherche incomplete" }, { status: 400 });
  }

  const state = await addSavedSearch({
    label: body.label,
    kind: body.kind,
    body: body.searchBody
  });
  return Response.json({ state });
}

export async function DELETE(request: Request) {
  const { id } = (await request.json()) as { id?: string };
  const state = await updateState((draft) => {
    draft.savedSearches = draft.savedSearches.filter((search) => search.id !== id);
  });
  return Response.json({ state });
}
