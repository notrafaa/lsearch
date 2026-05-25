import type { BrixResponse } from "./types";

const defaultBase = "https://brixhub.net/api/v1";

export function apiConfig() {
  return {
    key: process.env.BRIXHUB_API_KEY || "",
    baseUrl: (process.env.BRIXHUB_BASE_URL || defaultBase).replace(/\/$/, ""),
    userAgent: process.env.APP_USER_AGENT || "LSearch/1.0"
  };
}

export async function brixFetch(
  pathname: string,
  init?: RequestInit
): Promise<{ response: Response | null; json: BrixResponse }> {
  const config = apiConfig();
  if (!config.key) {
    return {
      response: null,
      json: {
        status: 500,
        message: "BRIXHUB_API_KEY manquante dans .env.local",
        data: null
      } satisfies BrixResponse
    };
  }

  const response = await fetch(`${config.baseUrl}${pathname}`, {
    ...init,
    headers: {
      "X-API-Key": config.key,
      "User-Agent": config.userAgent,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers
    },
    cache: "no-store"
  });

  let json: BrixResponse;
  try {
    json = (await response.json()) as BrixResponse;
  } catch {
    json = {
      status: response.status,
      message: "Reponse non JSON recue depuis BrixHub",
      data: null
    };
  }

  return { response, json };
}
