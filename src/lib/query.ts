const allowedFields = new Set([
  "nom_famille",
  "prenom",
  "nom_naissance",
  "nom_affichage",
  "nom_utilisateur",
  "date_naissance",
  "annee_naissance",
  "jour_naissance",
  "mois_naissance",
  "genre",
  "civilite",
  "email",
  "telephone",
  "mobile",
  "adresse_ip",
  "adresse",
  "complement_adresse",
  "code_postal",
  "ville",
  "ville_naissance",
  "lieu_naissance",
  "pays",
  "region",
  "departement",
  "nir",
  "iban",
  "bic",
  "siret",
  "siren",
  "vin_plaque",
  "immatriculation",
  "numero_serie",
  "marque",
  "modele",
  "societe",
  "profession",
  "fonction",
  "page",
  "per_page",
  "flexible"
]);

const numberFields = new Set(["page", "per_page", "jour_naissance", "mois_naissance"]);

export function sanitizeSearchBody(input: Record<string, unknown>) {
  const body: Record<string, unknown> = {};

  Object.entries(input).forEach(([key, value]) => {
    if (!allowedFields.has(key) || value === null || typeof value === "undefined") return;

    if (numberFields.has(key)) {
      const parsed = typeof value === "number" ? value : Number(String(value).trim());
      if (Number.isFinite(parsed)) body[key] = Math.max(1, Math.floor(parsed));
      return;
    }

    if (key === "flexible") {
      body[key] = value === true || value === "true" || value === "oui" || value === "1";
      return;
    }

    const text = String(value).trim();
    if (text) body[key] = text;
  });

  if (!body.per_page) body.per_page = 10;
  if (!body.page) body.page = 1;
  if (typeof body.flexible === "undefined") body.flexible = false;

  return body;
}

export function parsePrompt(prompt: string) {
  const body: Record<string, unknown> = {};
  const tokenRegex = /([\w_]+):("[^"]+"|'[^']+'|[^\s]+)/g;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(prompt))) {
    const key = match[1];
    const raw = match[2].replace(/^["']|["']$/g, "");
    if (!allowedFields.has(key)) continue;
    if (numberFields.has(key)) {
      body[key] = Number(raw);
    } else if (key === "flexible") {
      body[key] = raw === "true" || raw === "oui" || raw === "1";
    } else {
      body[key] = raw;
    }
  }

  if (Object.keys(body).length === 0 && prompt.trim()) {
    body.nom_affichage = prompt.trim();
    body.flexible = true;
  }

  return sanitizeSearchBody(body);
}

export function queryLabel(body: Record<string, unknown>) {
  return Object.entries(body)
    .filter(([key]) => !["page", "per_page", "flexible"].includes(key))
    .map(([key, value]) => `${key}:${String(value)}`)
    .join(" ");
}
