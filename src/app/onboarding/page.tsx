import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { listClients } from "@/lib/clients";
import CreateClientForm from "@/components/onboarding/CreateClientForm";

export default async function OnboardingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const clients = await listClients(session.user.id);
  if (clients.length > 0) {
    redirect(`/clients/${clients[0].id}/connections`);
  }

  return (
    <main style={{ maxWidth: 520, margin: "10vh auto", padding: 24 }}>
      <h1 style={{ fontSize: 24 }}>Welcome — create your first client</h1>
      <p style={{ marginTop: 8, color: "#9ca3af" }}>
        A client is an isolated workspace for one of your agency&apos;s accounts.
      </p>
      <div style={{ marginTop: 20 }}>
        <CreateClientForm />
      </div>
    </main>
  );
}
