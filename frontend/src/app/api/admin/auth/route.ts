import { cookies } from "next/headers";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// In-memory session store (simple, no database needed)
// Map<token, { email: string; createdAt: number }>
// ---------------------------------------------------------------------------

const SESSION_COOKIE = "admin_session";
const SESSION_MAX_AGE = 60 * 60 * 24; // 24 hours in seconds

// Use a global reference so the map survives hot-reloads in dev
const globalSessions = globalThis as unknown as {
  __adminSessions?: Map<string, { email: string; createdAt: number }>;
};
if (!globalSessions.__adminSessions) {
  globalSessions.__adminSessions = new Map();
}
const sessions = globalSessions.__adminSessions;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isValidSession(token: string): boolean {
  const session = sessions.get(token);
  if (!session) return false;
  const elapsed = (Date.now() - session.createdAt) / 1000;
  if (elapsed > SESSION_MAX_AGE) {
    sessions.delete(token);
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// POST /api/admin/auth -- login
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || !body.email || !body.password) {
    return Response.json(
      { authenticated: false, error: "Email and password are required" },
      { status: 400 },
    );
  }

  const expectedEmail = process.env.ADMIN_EMAIL;
  const expectedPassword = process.env.ADMIN_PASSWORD;

  if (!expectedEmail || !expectedPassword) {
    console.error(
      "ADMIN_EMAIL or ADMIN_PASSWORD environment variables are not set",
    );
    return Response.json(
      { authenticated: false, error: "Server configuration error" },
      { status: 500 },
    );
  }

  if (body.email !== expectedEmail || body.password !== expectedPassword) {
    return Response.json(
      { authenticated: false, error: "Invalid credentials" },
      { status: 401 },
    );
  }

  // Create session
  const token = crypto.randomUUID();
  sessions.set(token, { email: body.email, createdAt: Date.now() });

  // Set cookie
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
    sameSite: "lax",
  });

  return Response.json({ authenticated: true });
}

// ---------------------------------------------------------------------------
// GET /api/admin/auth -- check session
// ---------------------------------------------------------------------------

export async function GET() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE);

  if (!sessionCookie || !isValidSession(sessionCookie.value)) {
    return Response.json({ authenticated: false });
  }

  return Response.json({ authenticated: true });
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/auth -- logout
// ---------------------------------------------------------------------------

export async function DELETE() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE);

  if (sessionCookie) {
    sessions.delete(sessionCookie.value);
  }

  cookieStore.delete(SESSION_COOKIE);

  return Response.json({ authenticated: false });
}
