import { redirect } from "next/navigation";
import { requireUser, listClients, resolveActiveClientId } from "@/lib/clients";
import { OnboardingForm } from "./OnboardingForm";

// D-03: after login, if the user has zero clients, send them to onboarding.
export default async function OnboardingPage() {
  const userId = await requireUser().catch(() => null);
  if (!userId) redirect("/login");

  const clients = await listClients(userId);
  if (clients.length > 0) {
    const active = await resolveActiveClientId();
    redirect(active ? `/clients/${active}/connections` : "/dashboard");
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-2 text-xl font-semibold">Create your first client</h1>
      <p className="mb-6 text-sm text-white/60">
        A client is a workspace for one of your agency&apos;s customers. You can
        connect their social accounts here.
      </p>
      <OnboardingForm />
    </main>
  );
}
