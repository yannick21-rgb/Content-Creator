import Link from "next/link";
import { getActiveClientId } from "@/lib/clients";
import ClientSwitcher from "./ClientSwitcher";

export default async function AppNav() {
  const activeClientId = await getActiveClientId();
  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "12px 20px",
        borderBottom: "1px solid #1f2937",
      }}
    >
      <Link href="/dashboard" style={{ fontWeight: 700, color: "#e6edf3" }}>
        Content-Creator
      </Link>
      <ClientSwitcher />
      {activeClientId && (
        <Link
          href={`/clients/${activeClientId}/connections`}
          style={{ color: "#93c5fd" }}
        >
          Connections
        </Link>
      )}
    </nav>
  );
}
