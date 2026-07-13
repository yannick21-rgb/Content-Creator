import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { listClients } from "@/lib/clients";
import { SignOutButton } from "@/components/SignOutButton";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }

  // D-03: no client workspace yet → onboarding (create the first one).
  const clients = await listClients(session.user.id);
  if (clients.length === 0) {
    redirect("/onboarding");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-sm text-white/70">
        Signed in as <span className="font-medium">{session.user.email}</span>
      </p>
      <SignOutButton />
    </main>
  );
}
