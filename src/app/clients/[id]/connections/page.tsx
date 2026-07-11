import { redirect } from "next/navigation";
import AppNav from "@/components/nav/AppNav";
import ConnectionsView from "@/components/connections/ConnectionsView";
import { resolveActiveClientId } from "@/lib/clients";

export default async function ClientConnectionsPage() {
  const activeClientId = await resolveActiveClientId();
  // D-07: null → onboarding (no remaining client). Never a broken page.
  if (!activeClientId) redirect("/onboarding");

  return (
    <>
      <AppNav />
      <ConnectionsView clientId={activeClientId} />
    </>
  );
}
