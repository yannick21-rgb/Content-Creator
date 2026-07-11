import type { ConnectionStatus } from "@/lib/connection-status";

export interface ConnectionCardProps {
  platform: "meta" | "linkedin";
  name: string | null;
  status: ConnectionStatus;
  reconnectUrl: string;
}

export default function ConnectionCard({
  platform,
  name,
  status,
  reconnectUrl,
}: ConnectionCardProps) {
  const isReconnect = status === "reconnect_required";
  return (
    <div
      style={{
        border: "1px solid #1f2937",
        borderRadius: 12,
        padding: 16,
        background: "#0b0f17",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <strong style={{ textTransform: "capitalize" }}>{platform}</strong>
          {name && <div style={{ color: "#9ca3af", fontSize: 13 }}>{name}</div>}
        </div>
        {isReconnect ? (
          <a
            href={reconnectUrl}
            style={{
              fontSize: 12,
              padding: "4px 10px",
              borderRadius: 999,
              background: "#78350f",
              color: "#fcd34d",
              textDecoration: "none",
            }}
          >
            Reconnect required
          </a>
        ) : (
          <span
            style={{
              fontSize: 12,
              padding: "4px 10px",
              borderRadius: 999,
              background: "#064e3b",
              color: "#6ee7b7",
            }}
          >
            Connected
          </span>
        )}
      </div>
    </div>
  );
}
