"use client";

import { useState, useEffect, useMemo } from "react";

const REGION_ORDER = [
  "America", "Europe", "Asia", "Africa", "Australia", "Pacific", "Atlantic", "Indian", "Etc",
];

export function TimezonePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (tz: string) => void;
}) {
  const [detected, setDetected] = useState("");

  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setDetected(detected);
    if (!value) {
      onChange(detected);
    }
  }, []);

  const allTimezones = useMemo(() => {
    const zones = Intl.supportedValuesOf("timeZone");
    const grouped: Record<string, string[]> = {};
    for (const z of zones) {
      const region = z.split("/")[0] ?? "Other";
      if (!grouped[region]) grouped[region] = [];
      grouped[region].push(z);
    }
    return grouped;
  }, []);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded border p-2 text-sm"
      aria-label="Time zone"
    >
      <option value="" disabled>
        Select time zone{detected ? ` (detected: ${detected})` : ""}
      </option>
      {REGION_ORDER.filter((r) => allTimezones[r]).map((region) => (
        <optgroup label={region} key={region}>
          {allTimezones[region].map((tz) => (
            <option key={tz} value={tz}>
              {tz.replace(/_/g, " ")}
              {tz === detected ? " (current)" : ""}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
