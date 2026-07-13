import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  listClients,
  resolveActiveClientId,
  listConnections,
} from "@/lib/clients";
import { listPosts, getScheduledPosts } from "@/lib/posts";

const PLATFORM_LABEL: Record<string, string> = {
  meta: "Meta",
  instagram: "Instagram",
  linkedin: "LinkedIn",
};

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const userId = session.user.id;
  const clients = await listClients(userId);
  const activeClientId = await resolveActiveClientId();
  if (!activeClientId) redirect("/onboarding");

  const activeClient = clients.find((c) => c.id === activeClientId)!;
  const connections = await listConnections(activeClientId);
  const posts = await listPosts({ clientId: activeClientId });
  const scheduled = await getScheduledPosts(activeClientId);

  const counts = {
    draft: posts.filter((p) => p.status === "draft").length,
    scheduled: posts.filter((p) => p.status === "scheduled").length,
    published: posts.filter((p) => p.status === "published").length,
    failed: posts.filter((p) => p.status === "failed").length,
  };

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-gray-500">
            Client&nbsp;: <span className="font-medium">{activeClient.name}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/compose/new"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            New post
          </Link>
          <Link
            href={`/clients/${activeClientId}/connections`}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm"
          >
            Connect account
          </Link>
        </div>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Clients" value={clients.length} />
        <Stat label="Connected accounts" value={connections.length} />
        <Stat label="Scheduled" value={counts.scheduled} />
        <Stat label="Published" value={counts.published} />
      </section>

      <section className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold mb-3">Upcoming scheduled posts</h2>
          {scheduled.length === 0 ? (
            <p className="text-sm text-gray-500">Nothing scheduled yet.</p>
          ) : (
            <ul className="space-y-2">
              {scheduled.slice(0, 8).map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between text-sm border-b pb-2"
                >
                  <span className="truncate max-w-xs">
                    {p.title || p.text || "(untitled)"}
                  </span>
                  <span className="text-gray-500">
                    {p.publishTargets
                      .map((t) =>
                        t.socialAccount
                          ? PLATFORM_LABEL[t.socialAccount.platform] ?? t.socialAccount.platform
                          : "—",
                      )
                      .join(", ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/schedule" className="inline-block mt-3 text-sm text-blue-600 hover:underline">
            View schedule →
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold mb-3">Connected accounts</h2>
          {connections.length === 0 ? (
            <p className="text-sm text-gray-500">
              No accounts connected.{" "}
              <Link href={`/clients/${activeClientId}/connections`} className="text-blue-600 hover:underline">
                Connect one
              </Link>
              .
            </p>
          ) : (
            <ul className="space-y-2">
              {connections.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between text-sm border-b pb-2"
                >
                  <span>
                    <span className="font-medium">
                      {PLATFORM_LABEL[c.platform] ?? c.platform}
                    </span>
                    {c.name ? <span className="text-gray-500"> · {c.name}</span> : null}
                  </span>
                  <span
                    className={
                      c.status === "reconnect_required"
                        ? "text-amber-600 text-xs"
                        : "text-green-600 text-xs"
                    }
                  >
                    {c.status === "reconnect_required" ? "Reconnect required" : "Connected"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="bg-white rounded-lg shadow p-4">
        <h2 className="font-semibold mb-3">Recent posts</h2>
        {posts.length === 0 ? (
          <p className="text-sm text-gray-500">No posts yet.</p>
        ) : (
          <ul className="space-y-2">
            {posts.slice(0, 10).map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between text-sm border-b pb-2"
              >
                <Link
                  href={`/compose/post/${p.id}`}
                  className="truncate max-w-md hover:underline"
                >
                  {p.title || p.text || "(untitled)"}
                </Link>
                <StatusBadge status={p.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    scheduled: "bg-blue-100 text-blue-700",
    published: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
    running: "bg-amber-100 text-amber-700",
  };
  return (
    <span className={`text-xs px-2 py-1 rounded ${map[status] ?? "bg-gray-100 text-gray-700"}`}>
      {status}
    </span>
  );
}
