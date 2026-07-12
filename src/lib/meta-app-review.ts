const META_API = "https://graph.facebook.com/v22.0";

export type AppReviewStatus = "pending" | "approved" | "limited" | "unknown";

export async function checkMetaAppReview(appId?: string): Promise<AppReviewStatus> {
  const id = appId ?? process.env.META_CLIENT_ID;
  const token = process.env.META_APP_TOKEN ?? process.env.META_CLIENT_ID;
  if (!id) return "unknown";
  try {
    const res = await fetch(
      `${META_API}/${id}?fields=app_review_status&access_token=${token}`,
    );
    const json = await res.json() as {
      app_review_status?: string;
      error?: { message: string };
    };
    if (json.error) {
      console.warn("Meta app review check failed:", json.error.message);
      return "unknown";
    }
    const status = json.app_review_status ?? "unknown";
    if (status === "approved") return "approved";
    if (status === "pending") return "pending";
    if (status === "limited") return "limited";
    return "unknown";
  } catch {
    return "unknown";
  }
}

export function canPublishWithReviewStatus(status: AppReviewStatus): {
  allowed: boolean;
  warning?: string;
} {
  if (status === "approved") return { allowed: true };
  if (status === "pending") {
    return {
      allowed: true,
      warning: "App review pending — publishing may fail for non-test users.",
    };
  }
  if (status === "limited") {
    return {
      allowed: true,
      warning: "App has limited access — some features may be unavailable.",
    };
  }
  return {
    allowed: true,
    warning: "Could not verify Meta app review status.",
  };
}
