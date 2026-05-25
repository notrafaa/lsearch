"use client";

import {
  ArrowUp,
  AtSign,
  BookOpen,
  Clock3,
  Copy,
  Database,
  History,
  LayoutGrid,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Plus,
  Save,
  Search,
  Sparkles,
  UserRound,
  Wand2
} from "lucide-react";
import type { ReactNode } from "react";
import { FormEvent, useEffect, useMemo, useState } from "react";

type AppState = {
  savedSearches: Array<{ id: string; label: string; kind: "search" | "lookup"; body: Record<string, unknown> }>;
  usage: Array<{ id: string; endpoint: string; status: number; queryLabel: string; createdAt: string }>;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  payload?: BrixEnvelope;
};

type BrixEnvelope = {
  status?: number;
  message?: string;
  data?: { results?: PersonResult[] } | PersonResult[] | Record<string, unknown> | null;
  meta?: { total?: number; took_ms?: number; query?: Record<string, unknown>; page?: number; pages?: number };
};

type PersonResult = Record<string, unknown> & {
  _confidence?: number;
  _sources?: string[];
  prenom?: string;
  nom_famille?: string;
  nom_affichage?: string;
  email?: string;
  telephone?: string;
  mobile?: string;
  ville?: string;
  code_postal?: string;
  adresse?: string;
  date_naissance?: string;
  nom_utilisateur?: string;
};

const commandHints = [
  { command: "/prenom", example: "/prenom Tasty", label: "Prenom" },
  { command: "/nom", example: "/nom Crousty", label: "Nom" },
  { command: "/ville", example: "/ville Paris", label: "Ville" },
  { command: "/email", example: "/email nom@domaine.fr", label: "Email" },
  { command: "/tel", example: "/tel 0612345678", label: "Telephone" },
  { command: "/username", example: "/username tasty_85", label: "Pseudo" }
];

const starterPrompts = [
  "Je veux trouver Tasty Crousty",
  "/prenom Tasty /nom Crousty",
  "Cherche une personne avec email exemple@domaine.fr",
  "Retrouve le telephone 0612345678"
];

const toolTabs = [
  { id: "chat", label: "Chat", icon: Sparkles },
  { id: "tools", label: "Outils", icon: LayoutGrid },
  { id: "guide", label: "Guide", icon: BookOpen },
  { id: "history", label: "Historique", icon: History }
] as const;

type ActiveTab = (typeof toolTabs)[number]["id"];

export default function Dashboard() {
  const [state, setState] = useState<AppState | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Dis-moi ce que tu veux chercher en francais. Je comprends aussi les commandes slash comme /prenom Tasty /nom Crousty."
    }
  ]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("chat");
  const [lookupMode, setLookupMode] = useState<"email" | "phone" | "iban">("email");
  const [apiRemaining, setApiRemaining] = useState("?");
  const [apiLimit, setApiLimit] = useState("?");

  const showCommands = prompt.includes("/") || prompt.length === 0;
  const lastResult = messages.find((message) => message.payload)?.payload;

  async function refresh() {
    const response = await fetch("/api/me");
    if (!response.ok) return;
    const data = await response.json();
    setState(data.state);
    setApiRemaining(data.rateLimit?.dayRemaining ?? "?");
    setApiLimit(data.rateLimit?.dayLimit ?? "?");
  }

  useEffect(() => {
    refresh();
  }, []);

  function append(message: Omit<Message, "id">) {
    setMessages((current) => [...current, { ...message, id: crypto.randomUUID() }]);
  }

  async function runSearch(event?: FormEvent, savedBody?: Record<string, unknown>) {
    event?.preventDefault();
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt && !savedBody) return;

    setActiveTab("chat");
    setLoading(true);
    append({ role: "user", text: savedBody ? formatQuery(savedBody) : cleanPrompt });

    const response = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(savedBody ? { body: savedBody } : { prompt: cleanPrompt })
    });
    const data = await response.json();
    setLoading(false);
    setPrompt("");
    setApiRemaining(data.rateLimit?.dayRemaining ?? apiRemaining);
    setApiLimit(data.rateLimit?.dayLimit ?? apiLimit);
    append({
      role: "assistant",
      text: response.ok ? summarizeResult(data.result) : data.message || "Recherche impossible.",
      payload: response.ok ? data.result : undefined
    });
    refresh();
  }

  async function runLookup(value: string, type = lookupMode) {
    const cleanValue = value.trim();
    if (!cleanValue) return;
    setActiveTab("chat");
    setLoading(true);
    append({ role: "user", text: `Lookup ${type}: ${cleanValue}` });
    const response = await fetch("/api/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, value: cleanValue })
    });
    const data = await response.json();
    setLoading(false);
    setApiRemaining(data.rateLimit?.dayRemaining ?? apiRemaining);
    setApiLimit(data.rateLimit?.dayLimit ?? apiLimit);
    append({
      role: "assistant",
      text: response.ok ? summarizeResult(data.result) : data.message || "Lookup impossible.",
      payload: response.ok ? data.result : undefined
    });
    refresh();
  }

  async function saveLastSearch() {
    const query = lastResult?.meta?.query;
    if (!query) return;
    const label = formatQuery(query);
    const response = await fetch("/api/saved-searches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, kind: "search", searchBody: query })
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

  const suggestions = useMemo(() => {
    const last = prompt.split(/\s/).pop()?.toLowerCase() || "";
    return commandHints.filter((hint) => hint.command.startsWith(last) || hint.label.toLowerCase().includes(last.replace("/", "")));
  }, [prompt]);

  return (
    <main className="ai-shell">
      <aside className="ai-sidebar">
        <div className="ai-brand">
          <div className="ai-logo">LS</div>
          <strong>LSearch</strong>
        </div>

        <button className="new-chat" onClick={() => setMessages([])}>
          <Plus size={18} />
          Nouveau chat
        </button>

        <nav className="side-nav">
          {toolTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <section className="saved-chats">
          <h3>Recherches</h3>
          {state?.savedSearches.length ? (
            state.savedSearches.slice(0, 10).map((search) => (
              <div className="saved-chat" key={search.id}>
                <button onClick={() => runSearch(undefined, search.body)}>{search.label}</button>
                <button aria-label="Supprimer" onClick={() => deleteSaved(search.id)}>
                  x
                </button>
              </div>
            ))
          ) : (
            <p>Aucune sauvegarde.</p>
          )}
        </section>

        <div className="api-pill">
          <Database size={16} />
          <span>API restante</span>
          <strong>
            {apiRemaining}/{apiLimit}
          </strong>
        </div>
      </aside>

      <section className="ai-main">
        <header className="ai-topbar">
          <div>
            <span className="eyebrow">Recherche intelligente</span>
            <h1>{messages.length <= 1 ? "Que veux-tu trouver ?" : "Conversation"}</h1>
          </div>
          <button className="ghost-button" onClick={logout}>
            <LogOut size={18} />
            Sortir
          </button>
        </header>

        <div className="tab-stage">
          {activeTab === "chat" ? (
            <ChatView messages={messages} loading={loading} onSave={saveLastSearch} />
          ) : activeTab === "tools" ? (
            <ToolsView lookupMode={lookupMode} setLookupMode={setLookupMode} runLookup={runLookup} />
          ) : activeTab === "guide" ? (
            <GuideView setPrompt={setPrompt} setActiveTab={setActiveTab} />
          ) : (
            <HistoryView usage={state?.usage || []} />
          )}
        </div>

        <form className="mega-composer" onSubmit={runSearch}>
          {showCommands ? (
            <div className="command-tray">
              {suggestions.slice(0, 6).map((hint) => (
                <button
                  type="button"
                  key={hint.command}
                  onClick={() => setPrompt((current) => `${current.trim()} ${hint.example}`.trim())}
                >
                  <span>{hint.command}</span>
                  <small>{hint.example}</small>
                </button>
              ))}
            </div>
          ) : null}

          <div className="composer-box">
            <button type="button" className="round-button" onClick={() => setActiveTab("tools")}>
              <Plus size={20} />
            </button>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Je veux trouver Tasty Crousty, ou /prenom Tasty /nom Crousty"
              rows={1}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  runSearch();
                }
              }}
            />
            <button disabled={loading} className="send-button" type="submit">
              <ArrowUp size={19} />
            </button>
          </div>

          <div className="starter-row">
            {starterPrompts.map((starter) => (
              <button type="button" key={starter} onClick={() => setPrompt(starter)}>
                {starter}
              </button>
            ))}
          </div>
        </form>
      </section>
    </main>
  );
}

function ChatView({ messages, loading, onSave }: { messages: Message[]; loading: boolean; onSave: () => void }) {
  if (!messages.length) {
    return (
      <section className="empty-chat">
        <Sparkles size={36} />
        <h2>Quel est le programme aujourd&apos;hui ?</h2>
        <p>Ecris en francais, colle un email, un telephone, ou utilise les commandes slash.</p>
      </section>
    );
  }

  return (
    <section className="chat-thread">
      {messages.map((message) => (
        <article className={`chat-message ${message.role}`} key={message.id}>
          <div className="message-avatar">{message.role === "user" ? "Vous" : "LS"}</div>
          <div className="message-body">
            <p>{message.text}</p>
            {message.payload ? <ResultRenderer payload={message.payload} onSave={onSave} /> : null}
          </div>
        </article>
      ))}
      {loading ? (
        <article className="chat-message assistant">
          <div className="message-avatar">LS</div>
          <div className="typing">Recherche en cours...</div>
        </article>
      ) : null}
    </section>
  );
}

function ResultRenderer({ payload, onSave }: { payload: BrixEnvelope; onSave: () => void }) {
  const results = extractResults(payload);
  const meta = payload.meta || {};

  return (
    <div className="result-block">
      <div className="result-summary">
        <strong>{typeof meta.total === "number" ? `${meta.total} resultat(s)` : `${results.length} resultat(s)`}</strong>
        <span>{typeof meta.took_ms === "number" ? `${meta.took_ms} ms` : "temps inconnu"}</span>
        {meta.query ? <code>{formatQuery(meta.query)}</code> : null}
        <button onClick={onSave}>
          <Save size={15} />
          Sauver
        </button>
      </div>
      <div className="result-grid">
        {results.map((person, index) => (
          <PersonCard key={index} person={person} index={index} />
        ))}
      </div>
    </div>
  );
}

function PersonCard({ person, index }: { person: PersonResult; index: number }) {
  const name = String(person.nom_affichage || [person.prenom, person.nom_famille].filter(Boolean).join(" ") || `Profil ${index + 1}`);
  const extraFields = Object.entries(person).filter(
    ([key, value]) =>
      value &&
      ![
        "_confidence",
        "_sources",
        "_source_files",
        "_es_ids",
        "nom_affichage",
        "prenom",
        "nom_famille",
        "email",
        "telephone",
        "mobile",
        "adresse",
        "ville",
        "code_postal",
        "date_naissance",
        "nom_utilisateur"
      ].includes(key)
  );

  return (
    <article className="person-card">
      <div className="person-head">
        <div>
          <span className="person-index">#{index + 1}</span>
          <h3>{name}</h3>
        </div>
        {typeof person._confidence === "number" ? <strong>{person._confidence}%</strong> : null}
      </div>
      <div className="identity-grid">
        <Info icon={<Mail size={15} />} value={person.email} />
        <Info icon={<Phone size={15} />} value={person.telephone || person.mobile} />
        <Info icon={<MapPin size={15} />} value={[person.adresse, person.code_postal, person.ville].filter(Boolean).join(", ")} />
        <Info icon={<UserRound size={15} />} value={person.nom_utilisateur || person.date_naissance} />
      </div>
      {person._sources?.length ? (
        <div className="sources">
          {person._sources.map((source) => (
            <span key={source}>{source}</span>
          ))}
        </div>
      ) : null}
      {extraFields.length ? (
        <details>
          <summary>Voir plus</summary>
          <div className="field-list">
            {extraFields.slice(0, 12).map(([key, value]) => (
              <div key={key}>
                <span>{key}</span>
                <strong>{String(value)}</strong>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </article>
  );
}

function Info({ icon, value }: { icon: ReactNode; value?: unknown }) {
  if (!value) return null;
  return (
    <div className="info-line">
      {icon}
      <span>{String(value)}</span>
      <button onClick={() => navigator.clipboard?.writeText(String(value))} aria-label="Copier">
        <Copy size={13} />
      </button>
    </div>
  );
}

function ToolsView({
  lookupMode,
  setLookupMode,
  runLookup
}: {
  lookupMode: "email" | "phone" | "iban";
  setLookupMode: (mode: "email" | "phone" | "iban") => void;
  runLookup: (value: string, type?: "email" | "phone" | "iban") => void;
}) {
  const [value, setValue] = useState("");
  return (
    <section className="tool-board">
      <h2>Outils rapides</h2>
      <div className="tool-cards">
        <div className="tool-card">
          <AtSign size={24} />
          <h3>Reverse lookup</h3>
          <p>Colle un email, telephone ou IBAN pour lancer une recherche directe.</p>
          <div className="tool-tabs">
            {(["email", "phone", "iban"] as const).map((mode) => (
              <button key={mode} className={lookupMode === mode ? "active" : ""} onClick={() => setLookupMode(mode)}>
                {mode}
              </button>
            ))}
          </div>
          <input value={value} onChange={(event) => setValue(event.target.value)} placeholder="Identifiant exact" />
          <button className="primary-action" onClick={() => runLookup(value)}>
            <Search size={17} />
            Lancer
          </button>
        </div>
        <div className="tool-card">
          <Wand2 size={24} />
          <h3>Commandes slash</h3>
          <p>Combine plusieurs criteres dans le chat.</p>
          <div className="command-list">
            {commandHints.map((hint) => (
              <code key={hint.command}>{hint.example}</code>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function GuideView({ setPrompt, setActiveTab }: { setPrompt: (value: string) => void; setActiveTab: (tab: ActiveTab) => void }) {
  return (
    <section className="guide-board">
      <h2>Tutoriel interactif</h2>
      {starterPrompts.map((starter, index) => (
        <button
          className="guide-step"
          key={starter}
          onClick={() => {
            setPrompt(starter);
            setActiveTab("chat");
          }}
        >
          <span>{index + 1}</span>
          <div>
            <strong>{starter}</strong>
            <p>Clique pour charger cet exemple dans la zone de saisie.</p>
          </div>
        </button>
      ))}
    </section>
  );
}

function HistoryView({ usage }: { usage: AppState["usage"] }) {
  return (
    <section className="history-board">
      <h2>Historique</h2>
      {usage.length ? (
        usage.slice(0, 30).map((item) => (
          <article key={item.id}>
            <Clock3 size={16} />
            <div>
              <strong>{item.queryLabel}</strong>
              <span>
                {item.endpoint} · {item.status}
              </span>
            </div>
          </article>
        ))
      ) : (
        <p>Aucune activite pour le moment.</p>
      )}
    </section>
  );
}

function extractResults(payload: BrixEnvelope): PersonResult[] {
  const data = payload.data;
  if (Array.isArray(data)) return data as PersonResult[];
  if (data && typeof data === "object" && Array.isArray((data as { results?: unknown }).results)) {
    return (data as { results: PersonResult[] }).results;
  }
  if (data && typeof data === "object") return [data as PersonResult];
  return [];
}

function summarizeResult(result: BrixEnvelope) {
  if (!result) return "Aucune reponse.";
  if (result.message && result.message !== "ok") return result.message;
  const total = result.meta?.total;
  const took = result.meta?.took_ms;
  if (typeof total !== "undefined") return `${total} resultat(s) trouves${typeof took === "number" ? ` en ${took} ms` : ""}.`;
  return `Reponse recue avec le statut ${result.status ?? "ok"}.`;
}

function formatQuery(body: Record<string, unknown>) {
  return Object.entries(body)
    .filter(([key]) => !["page", "per_page", "flexible"].includes(key))
    .map(([key, value]) => `${key}:${String(value)}`)
    .join(" ");
}
