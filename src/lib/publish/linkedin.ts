import type {
  Publisher, PublishPlatform, PrepareResult, PublishResult,
  VerifyResult, PublishContext,
} from "./provider";

const LINKEDIN_API = "https://api.linkedin.com/rest";

export class LinkedInPublisher implements Publisher {
  platform: PublishPlatform = "linkedin";

  async prepare(post: any, _target: any): Promise<PrepareResult> {
    const errors: string[] = [];
    const mediaItems: any[] = post.media || [];

    if (!post.text && mediaItems.length === 0) {
      errors.push("Post must have text or media for LinkedIn");
    }

    if (post.text && post.text.length > 700) {
      errors.push("LinkedIn caption exceeds 700 character limit");
    }

    if (mediaItems.length > 1) {
      errors.push("LinkedIn does not support carousel posts");
    }

    if (mediaItems.length === 1) {
      const m = mediaItems[0];
      if (m.contentType?.startsWith("video/")) {
        errors.push("LinkedIn video publishing not supported in this phase");
      } else if (!["image/jpeg", "image/png", "image/gif"].includes(m.contentType)) {
        errors.push("LinkedIn image must be JPEG, PNG, or GIF");
      }
    }

    return { ready: errors.length === 0, errors: errors.length ? errors : undefined };
  }

  async publish(post: any, target: any, context: PublishContext): Promise<PublishResult> {
    const { accessToken } = context;
    const linkedinUserId = target.socialAccount?.platformAccountId || context.linkedinUserId;
    if (!linkedinUserId) {
      return { success: false, error: "No LinkedIn user ID in target" };
    }

    const mediaItems: any[] = post.media || [];
    const text = post.text || "";
    const authorUrn = `urn:li:person:${linkedinUserId}`;
    let mediaRef: string | undefined;
    let mediaFailed = false;

    if (mediaItems.length === 1) {
      try {
        const m = mediaItems[0];
        const initRes = await fetch(
          `${LINKEDIN_API}/images?action=initializeUpload`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
              "LinkedIn-Version": "202606",
              "X-Restli-Protocol-Version": "2.0.0",
            },
            body: JSON.stringify({
              initializeUploadRequest: {
                owner: authorUrn,
              },
            }),
          },
        );

        if (!initRes.ok) {
          const initError = await initRes.json().catch(() => ({}));
          mediaFailed = true;
        } else {
          const initData = await initRes.json() as { value?: { uploadUrl?: string; image?: string } };
          const uploadUrl = initData?.value?.uploadUrl;
          const imageUrn = initData?.value?.image;

          if (uploadUrl && imageUrn) {
            const imageRes = await fetch(m.publicUrl);
            const imageBuffer = await imageRes.arrayBuffer();

            const putRes = await fetch(uploadUrl, {
              method: "PUT",
              headers: { "Content-Type": m.contentType || "image/jpeg" },
              body: imageBuffer,
            });

            if (putRes.ok) {
              mediaRef = imageUrn;
            } else {
              mediaFailed = true;
            }
          } else {
            mediaFailed = true;
          }
        }
      } catch {
        mediaFailed = true;
      }
    }

    const postBody: Record<string, unknown> = {
      author: authorUrn,
      commentary: text,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
    };

    if (mediaRef) {
      postBody.content = {
        media: { id: mediaRef },
      };
    }

    const postRes = await fetch(`${LINKEDIN_API}/posts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "LinkedIn-Version": "202606",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(postBody),
    });

    if (postRes.ok) {
      const platformRef = postRes.headers.get("x-restli-id");
      const result: PublishResult = {
        success: true,
        platformRef: platformRef || undefined,
      };
      if (mediaFailed && text) {
        result.error = "published (media failed)";
      }
      return result;
    }

    let errorMsg = `LinkedIn API error: ${postRes.status}`;
    try {
      const errJson = await postRes.json() as { message?: string; serviceErrorCode?: number };
      if (errJson.message) {
        errorMsg += ` ${errJson.message}`;
      }
      if (errJson.serviceErrorCode !== undefined) {
        errorMsg += ` (serviceErrorCode: ${errJson.serviceErrorCode})`;
      }
    } catch {
      errorMsg += " (no parseable error body)";
    }
    return { success: false, error: errorMsg };
  }

  async verify(_targetId: string, platformRef: string): Promise<VerifyResult> {
    return { status: "published", platformRef };
  }
}
