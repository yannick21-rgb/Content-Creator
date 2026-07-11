"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface ClientSummary {
  id: string;
  name: string;
  connected_count: number;
  reconnect_required_count: number;
}

export default function ClientSwitcher() {
  const router = useRouter();
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: ClientSummary[]) => {
        setClients(data);
        const active = data.find((c) => c.connected_count >= 0 && c.id);
        setActiveId(activeId ?? (data[0]?.id ?? null));
      })
      .catch(() => setClients([]));
  }, []);

  async function select(id: string) {
    await fetch("/api/clients/active", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientId: id }),
    });
    setActiveId(id);
    setOpen(false);
    router.refresh();
  }

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase()),
  );

  const active = clients.find((c) => c.id === activeId);

  return (
    <div style={{ position: "relative", minWidth: 240 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={btnStyle}
        data-testid="client-switcher-button"
      >
        {active ? active.name : "Select client"}
        <span style={{ marginLeft: 8 }}>▾</span>
      </button>
      {open && (
        <div style={menuStyle}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clients…"
            style={searchStyle}
          />
          {filtered.length === 0 && (
            <div style={{ padding: 8, color: "#9ca3af" }}>No clients</div>
          )}
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => select(c.id)}
              style={itemStyle}
              data-testid={`client-item-${c.id}`}
            >
              <span>{c.name}</span>
              <span style={{ display: "flex", gap: 6 }}>
                {c.connected_count > 0 && (
                  <span style={badge("connected")}>{c.connected_count} connected</span>
                )}
                {c.reconnect_required_count > 0 && (
                  <span style={badge("reconnect")}>
                    {c.reconnect_required_count} reconnect
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #1f2937",
  background: "#0b0f17",
  color: "#e6edf3",
  cursor: "pointer",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const menuStyle: React.CSSProperties = {
  position: "absolute",
  top: "110%",
  left: 0,
  right: 0,
  background: "#0b0f17",
  border: "1px solid #1f2937",
  borderRadius: 8,
  padding: 6,
  zIndex: 50,
};

const searchStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  marginBottom: 6,
  borderRadius: 6,
  border: "1px solid #1f2937",
  background: "#06090f",
  color: "#e6edf3",
};

const itemStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "8px 10px",
  borderRadius: 6,
  border: "none",
  background: "transparent",
  color: "#e6edf3",
  cursor: "pointer",
  textAlign: "left",
};

function badge(kind: "connected" | "reconnect"): React.CSSProperties {
  return {
    fontSize: 11,
    padding: "2px 6px",
    borderRadius: 999,
    background: kind === "connected" ? "#064e3b" : "#78350f",
    color: kind === "connected" ? "#6ee7b7" : "#fcd34d",
    whiteSpace: "nowrap",
  };
}
