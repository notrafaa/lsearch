import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { AppState, SavedSearch, UsageLog } from "./types";

const statePath = path.join(process.cwd(), "data", "app-state.json");

const defaultState = (): AppState => ({
  blacklist: [],
  savedSearches: [],
  usage: [],
  localQuota: {
    dailyLimit: 1000,
    day: new Date().toISOString().slice(0, 10),
    used: 0
  }
});

async function ensureDataDir() {
  await fs.mkdir(path.dirname(statePath), { recursive: true });
}

function rollQuota(state: AppState) {
  const today = new Date().toISOString().slice(0, 10);
  if (state.localQuota.day !== today) {
    state.localQuota.day = today;
    state.localQuota.used = 0;
  }
}

export async function readState(): Promise<AppState> {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(statePath, "utf8");
    const state = { ...defaultState(), ...JSON.parse(raw) } as AppState;
    rollQuota(state);
    return state;
  } catch {
    const state = defaultState();
    await writeState(state);
    return state;
  }
}

export async function writeState(state: AppState) {
  await ensureDataDir();
  await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export async function updateState(mutator: (state: AppState) => void | Promise<void>) {
  const state = await readState();
  await mutator(state);
  rollQuota(state);
  await writeState(state);
  return state;
}

export async function addUsage(log: Omit<UsageLog, "id" | "createdAt">) {
  return updateState((state) => {
    state.usage.unshift({
      ...log,
      id: randomUUID(),
      createdAt: new Date().toISOString()
    });
    state.usage = state.usage.slice(0, 200);
  });
}

export async function addSavedSearch(search: Omit<SavedSearch, "id" | "createdAt">) {
  return updateState((state) => {
    state.savedSearches.unshift({
      ...search,
      id: randomUUID(),
      createdAt: new Date().toISOString()
    });
    state.savedSearches = state.savedSearches.slice(0, 50);
  });
}

export function normalizeTerm(term: string) {
  return term.trim().toLocaleLowerCase("fr-FR");
}

export function blacklistHit(value: unknown, blacklist: string[]) {
  const haystack = JSON.stringify(value ?? "").toLocaleLowerCase("fr-FR");
  return blacklist.map(normalizeTerm).find((term) => term && haystack.includes(term));
}
