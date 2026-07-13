"use client";

import { useEffect, useState, useCallback } from "react";
import { TimezonePicker } from "@/components/schedule/TimezonePicker";
import { ScheduleList } from "@/components/schedule/ScheduleList";
import { CalendarView } from "@/components/schedule/CalendarView";

type Tab = "list" | "calendar";

export default function SchedulePage() {
  const [tab, setTab] = useState<Tab>("list");
  const [posts, setPosts] = useState<any[]>([]);
  const [timezone, setTimezone] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchSchedules = useCallback(async () => {
    try {
      const res = await fetch("/api/schedules");
      if (res.ok) {
        setPosts(await res.json());
      }
    } catch (e) {
      console.error("Failed to fetch schedules", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const scheduledPosts = posts.filter((p) => p.status === "scheduled");

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Scheduled Posts</h1>
      <div className="mb-4 max-w-xs">
        <label className="block text-sm font-medium mb-1">Display timezone</label>
        <TimezonePicker value={timezone} onChange={setTimezone} />
      </div>
      <div className="flex gap-2 mb-4 border-b">
        <button
          onClick={() => setTab("list")}
          className={`px-4 py-2 -mb-px border-b-2 ${tab === "list" ? "border-blue-500 font-semibold" : "border-transparent"}`}
        >
          List
        </button>
        <button
          onClick={() => setTab("calendar")}
          className={`px-4 py-2 -mb-px border-b-2 ${tab === "calendar" ? "border-blue-500 font-semibold" : "border-transparent"}`}
        >
          Calendar
        </button>
      </div>
      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : tab === "list" ? (
        <ScheduleList posts={scheduledPosts} timezone={timezone} />
      ) : (
        <CalendarView posts={scheduledPosts} timezone={timezone} />
      )}
    </div>
  );
}
