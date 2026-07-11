export type ConnectionStatus = "connected" | "reconnect_required";

// Reconnect threshold: a token within 7 days of expiry (or already expired, or
// unknown) requires re-auth (CONN-04).
const RECONNECT_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

export function statusFor(expiresAt: Date | null | undefined): ConnectionStatus {
  if (!expiresAt) return "reconnect_required";
  const threshold = new Date(Date.now() + RECONNECT_THRESHOLD_MS);
  return expiresAt.getTime() <= threshold.getTime()
    ? "reconnect_required"
    : "connected";
}
