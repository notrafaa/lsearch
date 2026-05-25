export type Role = "user" | "assistant" | "system";

export type ChatMessage = {
  id: string;
  role: Role;
  content: string;
  createdAt: string;
  payload?: unknown;
};

export type SavedSearch = {
  id: string;
  label: string;
  kind: "search" | "lookup";
  body: Record<string, unknown>;
  createdAt: string;
};

export type UsageLog = {
  id: string;
  endpoint: string;
  status: number;
  queryLabel: string;
  createdAt: string;
  localRemaining: number;
};

export type AppState = {
  savedSearches: SavedSearch[];
  usage: UsageLog[];
  localQuota: {
    dailyLimit: number;
    day: string;
    used: number;
  };
};

export type BrixResponse = {
  status: number;
  message?: string;
  data: unknown;
  meta?: Record<string, unknown>;
  timestamp?: string;
};
