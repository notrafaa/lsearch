import { createSession, setSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { username, password } = (await request.json()) as {
    username?: string;
    password?: string;
  };

  const expectedUser = process.env.APP_USERNAME || "admin";
  const expectedPassword = process.env.APP_PASSWORD || "change-me";

  if (username !== expectedUser || password !== expectedPassword) {
    return Response.json({ message: "Identifiants invalides" }, { status: 401 });
  }

  setSessionCookie(await createSession(username));
  return Response.json({ message: "ok" });
}
