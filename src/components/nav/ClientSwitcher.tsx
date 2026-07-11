"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ClientSummary = {
  id: string;
  name: string;
  connected_count: number;
  reconnect_required_count: number;
};

export function ClientSwitcher() {
  const router = useRouter();
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    const res = await fetch("/api/clients");
    if (res.ok) {
      const data = (await res.json()) as ClientSummary[];
      setClients(data);
    }
  }

  async function select(id: string) {
    setBusy(true);
    await fetch("/api/clients/active", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientId: id }),
    });
    setBusy(false);
    router.push(`/clients/${id}/connections`);
    router.refresh();
  }

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search clients…"
        className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-sm"
      />
      <ul className="mt-1 max-h-72 overflow-auto rounded-md border border-white/10 bg-zinc-900">
        {filtered.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              disabled={busy}
              onClick={() => select(c.id)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-white/5"
            >
              <span>{c.name}</span>
              <span className="flex gap-1">
                {c.connected_count > 0 && (
                  <span className="rounded bg-emerald-600/20 px-1.5 py-0.5 text-xs text-emerald-300">
                    {c.connected_count} connected
                  </span>
                )}
                {c.reconnect_required_count > 0 && (
                  <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-300">
                    {c.reconnect_required_count} reconnect
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="px-3 py-2 text-sm text-white/40">No clients</li>
        )}
      </ul>
    </div>
  );
}
