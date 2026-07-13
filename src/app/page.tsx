import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { listClients } from "@/lib/clients";

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }
  // D-03: a user with no client workspace goes to onboarding first.
  const clients = await listClients(session.user.id);
  if (clients.length === 0) {
    redirect("/onboarding");
  }
  redirect("/dashboard");
}
