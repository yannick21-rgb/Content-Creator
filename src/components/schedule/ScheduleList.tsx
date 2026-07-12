"use client";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-200 text-gray-700",
  scheduled: "bg-blue-100 text-blue-700",
  running: "bg-yellow-100 text-yellow-700",
  published: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

export function ScheduleList({ posts, timezone }: { posts: any[]; timezone: string }) {
  if (posts.length === 0) {
    return <p className="text-gray-500 text-sm">No scheduled posts yet.</p>;
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left">
          <th className="py-2 pr-4">Title</th>
          <th className="py-2 pr-4">Scheduled</th>
          <th className="py-2 pr-4">Targets</th>
        </tr>
      </thead>
      <tbody>
        {posts.map((post) => (
          <tr key={post.id} className="border-b hover:bg-gray-50">
            <td className="py-2 pr-4 font-medium">{post.title || post.text?.slice(0, 50)}</td>
            <td className="py-2 pr-4">
              {post.scheduledAt
                ? new Intl.DateTimeFormat("en-US", {
                    timeZone: timezone,
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(post.scheduledAt))
                : "—"}
            </td>
            <td className="py-2 pr-4">
              <div className="flex gap-1 flex-wrap">
                {post.publishTargets?.map((t: any) => (
                  <span
                    key={t.id}
                    className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[t.status] ?? "bg-gray-100"}`}
                  >
                    {t.socialAccount?.name ?? t.id.slice(0, 8)}: {t.status}
                  </span>
                ))}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
