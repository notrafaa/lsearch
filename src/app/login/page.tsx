"use client";

import { FormEvent, useState } from "react";
import { Lock, LogIn, User } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    setLoading(false);
    if (response.ok) {
      window.location.href = "/";
      return;
    }
    const data = await response.json().catch(() => ({}));
    setError(data.message || "Connexion impossible");
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="brand-mark">LS</div>
        <h1>LSearch</h1>
        <p>Console OSINT privee avec recherche conversationnelle, sauvegardes et historique structure.</p>
        <form onSubmit={submit} className="login-form">
          <label>
            <span>Username</span>
            <div className="input-with-icon">
              <User size={17} />
              <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
            </div>
          </label>
          <label>
            <span>Mot de passe</span>
            <div className="input-with-icon">
              <Lock size={17} />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
            </div>
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button disabled={loading} className="primary-button">
            <LogIn size={17} />
            {loading ? "Connexion..." : "Entrer"}
          </button>
        </form>
      </section>
    </main>
  );
}
