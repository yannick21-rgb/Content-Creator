import { redirect } from "next/navigation";
import {
  requireUser,
  resolveActiveClientId,
  assertClientOwned,
  listConnections,
} from "@/lib/clients";
import { db } from "@/lib/db";
import { client } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ConnectionCard } from "@/components/connections/ConnectionCard";

// D-04: default post-login landing — the client's social connections list.
export default async function ClientConnectionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await requireUser().catch(() => null);
  if (!userId) redirect("/login");

  // D-07: validate the cookie/route id against the user's clients; fall back.
  const resolved = await resolveActiveClientId();
  const { id } = await params;
  const effectiveId = resolved ?? id;
  if (!effectiveId) redirect("/onboarding");

  await assertClientOwned(effectiveId, userId).catch(() => redirect("/onboarding"));

  const [clientRow] = await db
    .select()
    .from(client)
    .where(eq(client.id, effectiveId));
  if (!clientRow) redirect("/onboarding");

  const connections = await listConnections(effectiveId);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 text-2xl font-semibold">{clientRow.name}</h1>
      <p className="mb-6 text-sm text-white/60">Connected social accounts</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <ConnectionCard
          clientId={effectiveId}
          platform="meta"
          connection={connections.find((c) => c.platform === "meta") ?? null}
        />
        <ConnectionCard
          clientId={effectiveId}
          platform="linkedin"
          connection={connections.find((c) => c.platform === "linkedin") ?? null}
        />
      </div>
    </main>
  );
}
