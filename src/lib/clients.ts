import { cookies, headers } from "next/headers";
import { db } from "./db";
import { client, socialAccount } from "./db/schema";
import { eq, and, sql, type SQL } from "drizzle-orm";
import { auth } from "./auth";
import { statusFor, type ConnectionStatus } from "./connection-status";

export const ACTIVE_CLIENT_COOKIE = "active_client_id";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// Resolve the authenticated user id, throwing 401 when unauthenticated.
export async function requireUser(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    throw new HttpError(401, "Unauthenticated");
  }
  return session.user.id;
}

// Read the active client id from the server-readable cookie (D-02).
export async function getActiveClientId(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACTIVE_CLIENT_COOKIE)?.value ?? null;
}

// Write the active-client cookie (httpOnly, server-readable — not client-only).
export async function setActiveClientCookie(clientId: string): Promise<void> {
  const store = await cookies();
  store.set(ACTIVE_CLIENT_COOKIE, clientId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function listClients(userId: string) {
  return db.select().from(client).where(eq(client.userId, userId));
}

// Hard server-side scoping: connections are always filtered by clientId (D-02).
export async function listConnections(clientId: string) {
  const rows = await db
    .select()
    .from(socialAccount)
    .where(eq(socialAccount.clientId, clientId));
  return rows.map((row) => ({
    id: row.id,
    platform: row.platform,
    platformAccountId: row.platformAccountId,
    name: row.name,
    expiresAt: row.expiresAt,
    keyVersion: row.keyVersion,
    status: statusFor(row.expiresAt),
  }));
}

// D-07: safe resolver that validates the cookie against the user's clients and
// falls back to the first remaining client (or null → onboarding).
export async function resolveActiveClientId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return null;
  const cookieId = await getActiveClientId();
  const owned = await listClients(session.user.id);
  if (owned.length === 0) return null;
  if (cookieId && owned.some((c) => c.id === cookieId)) return cookieId;
  return owned[0].id;
}

// Per-client connection summary (D-05): connected + reconnect_required counts.
export async function clientConnectionSummary(
  clientId: string,
): Promise<{ connected_count: number; reconnect_required_count: number }> {
  const rows = await db
    .select({ expiresAt: socialAccount.expiresAt })
    .from(socialAccount)
    .where(eq(socialAccount.clientId, clientId));
  let connected = 0;
  let reconnect = 0;
  for (const r of rows) {
    if (statusFor(r.expiresAt) === "reconnect_required") reconnect++;
    else connected++;
  }
  return { connected_count: connected, reconnect_required_count: reconnect };
}

// Validate that a client belongs to the user (ownership scoping for [id] routes).
export async function assertClientOwned(
  clientId: string,
  userId: string,
): Promise<void> {
  const [row] = await db
    .select({ id: client.id })
    .from(client)
    .where(and(eq(client.id, clientId), eq(client.userId, userId)));
  if (!row) {
    throw new HttpError(404, "Client not found");
  }
}

export type { ConnectionStatus };
export { statusFor };
