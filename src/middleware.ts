import { NextResponse, type NextRequest } from "next/server";
import { verifySession } from "./lib/auth";

const publicPaths = ["/login", "/api/auth/login", "/_next", "/favicon.ico"];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const user = await verifySession(request.cookies.get("lsearch_session")?.value);
  if (!user && !pathname.startsWith("/api/")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!user && pathname.startsWith("/api/")) {
    return NextResponse.json({ message: "Non authentifie" }, { status: 401 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\.).*)"]
};
