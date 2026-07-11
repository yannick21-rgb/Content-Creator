"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateClientForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to create client");
      setLoading(false);
      return;
    }
    const row = await res.json();
    router.push(`/clients/${row.id}/connections`);
  }

  return (
    <div>
      <label style={{ display: "block", marginBottom: 8 }}>Client name</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Acme Co."
        style={inputStyle}
      />
      {error && <p style={{ color: "#f87171", marginTop: 8 }}>{error}</p>}
      <button
        onClick={submit}
        disabled={loading}
        style={{
          ...inputStyle,
          marginTop: 12,
          background: "#1d4ed8",
          color: "white",
          border: "none",
          cursor: "pointer",
        }}
      >
        Create client
      </button>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #1f2937",
  background: "#0b0f17",
  color: "#e6edf3",
};
