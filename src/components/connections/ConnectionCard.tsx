"use client";

import type { ConnectionStatus } from "@/lib/connection-status";

type ConnectionView = {
  id: string;
  platform: string;
  platformAccountId: string;
  name: string | null;
  expiresAt: Date | null;
  status: ConnectionStatus;
} | null;

const LABELS: Record<string, string> = {
  meta: "Meta (Facebook / Instagram)",
  linkedin: "LinkedIn",
};

export function ConnectionCard({
  clientId,
  platform,
  connection,
}: {
  clientId: string;
  platform: "meta" | "linkedin";
  connection: ConnectionView;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">{LABELS[platform] ?? platform}</h2>
        {connection && (
          <StatusBadge status={connection.status} />
        )}
      </div>

      {connection ? (
        <div className="mt-2 text-sm text-white/70">
          <p>{connection.name ?? connection.platformAccountId}</p>
          <a
            href={`/api/clients/${clientId}/connections/${connection.id}/reconnect`}
            className="mt-3 inline-block rounded-md border border-white/10 px-3 py-1.5 text-sm hover:bg-white/5"
          >
            {connection.status === "reconnect_required"
              ? "Reconnect required — re-authorize"
              : "Reconnect"}
          </a>
        </div>
      ) : (
        <a
          href={`/api/clients/${clientId}/connections/${platform}/start`}
          className="mt-3 inline-block rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium hover:bg-indigo-500"
        >
          Connect {LABELS[platform] ?? platform}
        </a>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: ConnectionStatus }) {
  if (status === "connected") {
    return (
      <span className="rounded bg-emerald-600/20 px-2 py-0.5 text-xs text-emerald-300">
        Connected
      </span>
    );
  }
  return (
    <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
      Reconnect required
    </span>
  );
}
