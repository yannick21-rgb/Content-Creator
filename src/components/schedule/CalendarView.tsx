"use client";

import { useState, useMemo } from "react";

export function CalendarView({ posts, timezone }: { posts: any[]; timezone: string }) {
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const scheduledDays = useMemo(() => {
    const days = new Set<number>();
    for (const p of posts) {
      if (p.scheduledAt) {
        const d = new Date(p.scheduledAt);
        if (d.getFullYear() === year && d.getMonth() === month) {
          days.add(d.getDate());
        }
      }
    }
    return days;
  }, [posts, year, month]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setMonth((m) => (m === 0 ? (setYear((y) => y - 1), 11) : m - 1))} className="px-3 py-1 border rounded">&larr;</button>
        <h2 className="text-lg font-semibold">{new Date(year, month).toLocaleString("en-US", { month: "long", year: "numeric" })}</h2>
        <button onClick={() => setMonth((m) => (m === 11 ? (setYear((y) => y + 1), 0) : m + 1))} className="px-3 py-1 border rounded">&rarr;</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-sm">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="font-semibold text-gray-500 py-1">{d}</div>
        ))}
        {Array.from({ length: firstDayOfWeek }, (_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const hasPost = scheduledDays.has(day);
          const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
          return (
            <div
              key={day}
              className={`py-2 rounded ${isToday ? "ring-2 ring-blue-400" : ""} ${hasPost ? "bg-blue-100 font-semibold" : ""}`}
            >
              {day}
              {hasPost && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mx-auto mt-0.5" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
