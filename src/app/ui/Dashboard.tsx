"use client";

import {
  BookmarkPlus,
  ChevronsLeftRight,
  LogOut,
  Mail,
  Phone,
  Play,
  RefreshCw,
  Save,
  Search,
  Trash2,
  WalletCards
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

type AppState = {
  savedSearches: Array<{ id: string; label: string; kind: "search" | "lookup"; body: Record<string, unknown> }>;
  usage: Array<{ id: string; endpoint: string; status: number; queryLabel: string; createdAt: string }>;
  localQuota: { dailyLimit: number; used: number; day: string };
};

type BrixStatus = {
  configured: boolean;
  ok: boolean;
  status: number;
  message: string | null;
};

type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  payload?: unknown;
};

const quickFields = [
  ["prenom", "Prenom"],
  ["nom_famille", "Nom"],
  ["ville", "Ville"],
  ["email", "Email"],
  ["telephone", "Telephone"],
  ["nom_utilisateur", "Username"]
] as const;

export default function Dashboard() {
  const [state, setState] = useState<AppState | null>(null);
  const [prompt, setPrompt] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [searchOptions, setSearchOptions] = useState({ flexible: true, perPage: 10, page: 1 });
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "hello",
      role: "assistant",
      text: "Console prete. Compose une recherche, lance un lookup, ou charge une operation sauvegardee."
    }
  ]);
  const [lookupType, setLookupType] = useState("email");
  const [lookupValue, setLookupValue] = useState("");
  const [dailyLimit, setDailyLimit] = useState(1000);
  const [loading, setLoading] = useState(false);
  const [brixPlan, setBrixPlan] = useState<Record<string, unknown> | null>(null);
  const [brixRate, setBrixRate] = useState<Record<string, string | null> | null>(null);
  const [brixStatus, setBrixStatus] = useState<BrixStatus | null>(null);

  const quotaPct = useMemo(() => {
    if (!state) return 0;
    return Math.min(100, Math.round((state.localQuota.used / state.localQuota.dailyLimit) * 100));
  }, [state]);

  async function refresh() {
    const response = await fetch("/api/me");
    if (!response.ok) return;
    const data = await response.json();
    setState(data.state);
    setDailyLimit(data.state.localQuota.dailyLimit);
    setBrixPlan(data.brix?.data || data.brix || null);
    setBrixRate(data.rateLimit || null);
    setBrixStatus(data.brixStatus || null);
  }

  useEffect(() => {
    refresh();
  }, []);

  function append(message: Omit<Message, "id">) {
    setMessages((current) => [{ ...message, id: crypto.randomUUID() }, ...current]);
  }

  function buildBody() {
    const body: Record<string, unknown> = {};
    Object.entries(fields).forEach(([key, value]) => {
      if (value.trim()) body[key] = value.trim();
    });
    body.flexible = searchOptions.flexible;
    body.per_page = searchOptions.perPage;
    body.page = searchOptions.page;
    return body;
  }

  async function runSearch(event?: FormEvent, savedBody?: Record<string, unknown>) {
    event?.preventDefault();
    const body = savedBody || buildBody();
    const hasFields = Object.keys(body).some((key) => !["flexible", "per_page", "page"].includes(key));
    if (!prompt.trim() && !hasFields && !savedBody) return;

    setLoading(true);
    append({ role: "user", text: savedBody ? `Recherche sauvegardee: ${JSON.stringify(savedBody)}` : prompt || JSON.stringify(body) });
    const response = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(savedBody ? { body: savedBody } : hasFields ? { body } : { prompt })
    });
    const data = await response.json();
    setLoading(false);
    append({
      role: "assistant",
      text: response.ok ? summarizeResult(data.result) : data.message || "Recherche impossible",
      payload: response.ok ? data.result : undefined
    });
    setPrompt("");
    refresh();
  }

  async function runLookup(saved?: { type?: unknown; value?: unknown }) {
    const type = String(saved?.type || lookupType);
    const value = String(saved?.value || lookupValue).trim();
    if (!value) return;
    setLoading(true);
    append({ role: "user", text: `Lookup ${type}: ${value}` });
    const response = await fetch("/api/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, value })
    });
    const data = await response.json();
    setLoading(false);
    append({
      role: "assistant",
      text: response.ok ? summarizeResult(data.result) : data.message || "Lookup impossible",
      payload: response.ok ? data.result : undefined
    });
    refresh();
  }

  async function saveSettings() {
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dailyLimit
      })
    });
    const data = await response.json();
    setState(data.state);
  }

  async function saveCurrentSearch() {
    const body = buildBody();
    const label = Object.entries(body)
      .filter(([key]) => !["flexible", "per_page", "page"].includes(key))
      .map(([key, value]) => `${key}:${value}`)
      .join(" ");
    if (!label) return;
    const response = await fetch("/api/saved-searches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, kind: "search", searchBody: body })
    });
    const data = await response.json();
    setState(data.state);
  }

  async function saveCurrentLookup() {
    if (!lookupValue.trim()) return;
    const response = await fetch("/api/saved-searches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: `${lookupType}:${lookupValue.trim()}`,
        kind: "lookup",
        searchBody: { type: lookupType, value: lookupValue.trim() }
      })
    });
    const data = await response.json();
    setState(data.state);
  }

  async function deleteSaved(id: string) {
    const response = await fetch("/api/saved-searches", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    const data = await response.json();
    setState(data.state);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const planLabel = useMemo(() => {
    if (!brixStatus?.configured) return "cle absente";
    if (!brixStatus.ok) return `erreur ${brixStatus.status}`;
    return String(brixPlan?.plan || "indisponible");
  }, [brixPlan, brixStatus]);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-head">
          <div className="brand-mark">LS</div>
          <div>
            <h1>LSearch</h1>
            <p>private intelligence</p>
          </div>
        </div>

        <section className="panel quota-panel">
          <div className="panel-title">
            <WalletCards size={17} />
            Quotas
          </div>
          <div className="quota-row">
            <span>Local</span>
            <strong>
              {state?.localQuota.used ?? 0}/{state?.localQuota.dailyLimit ?? 0}
            </strong>
          </div>
          <div className="meter">
            <span style={{ width: `${quotaPct}%` }} />
          </div>
          <p className="muted">Plan API: {planLabel}</p>
          {brixStatus?.message && !brixStatus.ok ? <p className="muted">{brixStatus.message}</p> : null}
          <p className="muted">API restante: {brixRate?.dayRemaining ?? "?"}/{brixRate?.dayLimit ?? "?"}</p>
        </section>

        <section className="panel settings-panel">
          <div className="panel-title">
            <Save size={17} />
            Parametres
          </div>
          <label className="compact-label">
            Quota local journalier
            <input type="number" value={dailyLimit} min={1} onChange={(event) => setDailyLimit(Number(event.target.value))} />
          </label>
          <button className="secondary-button" onClick={saveSettings}>
            <Save size={16} />
            Sauvegarder
          </button>
        </section>

        <section className="panel saved-panel">
          <div className="panel-title">
            <BookmarkPlus size={17} />
            Recherches
          </div>
          {state?.savedSearches.length ? (
            state.savedSearches.map((search) => (
              <div className="saved-item" key={search.id}>
                <button
                  onClick={() => {
                    if (search.kind === "lookup") {
                      runLookup(search.body);
                      return;
                    }
                    runSearch(undefined, search.body);
                  }}
                  title={search.kind === "lookup" ? "Charger" : "Relancer"}
                >
                  <Play size={14} />
                </button>
                <span>{search.label}</span>
                <button onClick={() => deleteSaved(search.id)} title="Supprimer">
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          ) : (
            <p className="muted">Aucune recherche sauvegardee.</p>
          )}
        </section>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <h2>Discussion</h2>
            <p>Analyse OSINT avec quotas, sauvegardes et historique de recherches.</p>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" onClick={refresh} title="Actualiser">
              <RefreshCw size={18} />
            </button>
            <button className="icon-button" onClick={logout} title="Se deconnecter">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <div className="search-grid">
          <form className="composer" onSubmit={runSearch}>
            <div className="field-grid">
              {quickFields.map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input value={fields[key] || ""} onChange={(event) => setFields({ ...fields, [key]: event.target.value })} />
                </label>
              ))}
            </div>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={'Ex: prenom:"Jean" nom_famille:Dupont ville:Paris flexible:true'}
            />
            <div className="option-row">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={searchOptions.flexible}
                  onChange={(event) => setSearchOptions({ ...searchOptions, flexible: event.target.checked })}
                />
                Flexible
              </label>
              <label>
                Page
                <input
                  type="number"
                  min={1}
                  value={searchOptions.page}
                  onChange={(event) => setSearchOptions({ ...searchOptions, page: Number(event.target.value) })}
                />
              </label>
              <label>
                Resultats
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={searchOptions.perPage}
                  onChange={(event) => setSearchOptions({ ...searchOptions, perPage: Number(event.target.value) })}
                />
              </label>
            </div>
            <div className="composer-actions">
              <button disabled={loading} className="primary-button">
                <Search size={17} />
                Rechercher
              </button>
              <button type="button" className="secondary-button" onClick={saveCurrentSearch}>
                <BookmarkPlus size={16} />
                Sauver
              </button>
            </div>
          </form>

          <div className="lookup-panel">
            <div className="panel-title">
              <Phone size={17} />
              Reverse lookup
            </div>
            <div className="segmented">
              {["email", "phone", "iban"].map((type) => (
                <button key={type} className={lookupType === type ? "active" : ""} onClick={() => setLookupType(type)}>
                  {type === "email" ? <Mail size={15} /> : <Search size={15} />}
                  {type}
                </button>
              ))}
            </div>
            <input value={lookupValue} onChange={(event) => setLookupValue(event.target.value)} placeholder="Identifiant exact" />
            <button disabled={loading} className="secondary-button" onClick={() => runLookup()}>
              <Play size={16} />
              Lancer
            </button>
            <button type="button" className="secondary-button" onClick={saveCurrentLookup}>
              <ChevronsLeftRight size={16} />
              Sauver
            </button>
          </div>
        </div>

        <section className="chat">
          {messages.map((message) => (
            <article className={`message ${message.role}`} key={message.id}>
              <div className="avatar">{message.role === "user" ? "U" : "AI"}</div>
              <div>
                <p>{message.text}</p>
                {message.payload ? <pre>{JSON.stringify(message.payload, null, 2)}</pre> : null}
              </div>
            </article>
          ))}
        </section>
      </section>

      <aside className="activity">
        <h2>Historique</h2>
        {state?.usage.length ? (
          state.usage.slice(0, 12).map((item) => (
            <div className="activity-item" key={item.id}>
              <span>{item.endpoint}</span>
              <strong>{item.status}</strong>
              <p>{item.queryLabel}</p>
            </div>
          ))
        ) : (
          <p className="muted">Pas encore d&apos;activite.</p>
        )}
      </aside>
    </main>
  );
}

function summarizeResult(result: unknown) {
  const value = result as { meta?: { total?: number; took_ms?: number }; status?: number; message?: string };
  if (!value) return "Aucune reponse.";
  if (value.message && value.message !== "ok") return value.message;
  const total = value.meta?.total;
  const took = value.meta?.took_ms;
  if (typeof total !== "undefined") return `${total} resultat(s) trouves en ${took ?? "?"} ms.`;
  return `Reponse recue avec le statut ${value.status ?? "ok"}.`;
}
