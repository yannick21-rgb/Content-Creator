import Link from "next/link";
import { ClientSwitcher } from "./ClientSwitcher";
import { getActiveClientId } from "@/lib/clients";

export async function AppNav() {
  const activeClientId = await getActiveClientId();
  return (
    <header className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3">
      <Link href="/dashboard" className="text-sm font-semibold">
        Content-Creator
      </Link>
      <div className="w-72">
        <ClientSwitcher />
      </div>
      <nav className="flex items-center gap-3 text-sm">
        {activeClientId && (
          <Link
            href={`/clients/${activeClientId}/connections`}
            className="text-white/70 hover:text-white"
          >
            Connections
          </Link>
        )}
      </nav>
    </header>
  );
}
