"use client";

import { useEffect, useState } from "react";
import ConnectionCard from "@/components/connections/ConnectionCard";

interface Connection {
  id: string;
  platform: "meta" | "linkedin";
  name: string | null;
  status: "connected" | "reconnect_required";
}

export default function ConnectionsView({ clientId }: { clientId: string }) {
  const [connections, setConnections] = useState<Connection[]>([]);

  useEffect(() => {
    fetch(`/api/clients/${clientId}/connections`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Connection[]) => setConnections(data))
      .catch(() => setConnections([]));
  }, [clientId]);

  const platforms: ("meta" | "linkedin")[] = ["meta", "linkedin"];

  return (
    <main style={{ maxWidth: 720, margin: "4vh auto", padding: 24 }}>
      <h1 style={{ fontSize: 24 }}>Connections</h1>
      <p style={{ color: "#9ca3af", marginTop: 4 }}>
        Connect this client&apos;s social accounts.
      </p>

      <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
        {platforms.map((p) => (
          <a
            key={p}
            href={`/api/clients/${clientId}/connections/${p}/start`}
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              background: "#1d4ed8",
              color: "white",
              textDecoration: "none",
              textTransform: "capitalize",
            }}
          >
            Connect {p}
          </a>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 24 }}>
        {connections.length === 0 && (
          <p style={{ color: "#9ca3af" }}>No connections yet.</p>
        )}
        {connections.map((c) => (
          <ConnectionCard
            key={c.id}
            platform={c.platform}
            name={c.name}
            status={c.status}
            reconnectUrl={`/api/clients/${clientId}/connections/${c.id}/reconnect`}
          />
        ))}
      </div>
    </main>
  );
}
