import type {
  Publisher, PublishPlatform, PrepareResult, PublishResult,
  VerifyResult, PublishContext,
} from "./provider";

const META_API = "https://graph.facebook.com/v22.0";

export class MetaPublisher implements Publisher {
  platform: PublishPlatform = "meta";

  async prepare(post: any, _target: any): Promise<PrepareResult> {
    const errors: string[] = [];
    if (!post.text && !post.media?.length) {
      errors.push("Post must have text or media");
    }
    if (post.text && post.text.length > 63206) {
      errors.push("Facebook caption exceeds 63,206 character limit");
    }
    if (post.media?.length) {
      for (const m of post.media) {
        if (m.contentType?.startsWith("video/") && !m.publicUrl) {
          errors.push("Video media missing public URL");
        }
      }
    }
    return { ready: errors.length === 0, errors: errors.length ? errors : undefined };
  }

  async publish(post: any, target: any, context: PublishContext): Promise<PublishResult> {
    const { accessToken } = context;
    const pageId = target.socialAccount?.platformAccountId || context.pageId;
    if (!pageId) return { success: false, error: "No page ID in target" };

    const mediaItems: any[] = post.media || [];
    let mediaFailed = false;
    const publishedMediaIds: string[] = [];

    for (const m of mediaItems) {
      try {
        const publicUrl = m.publicUrl;
        if (!publicUrl) {
          mediaFailed = true;
          continue;
        }
        if (m.contentType?.startsWith("video/")) {
          const videoRes = await fetch(
            `${META_API}/${pageId}/videos?file_url=${encodeURIComponent(publicUrl)}&access_token=${accessToken}`,
            { method: "POST" },
          );
          const videoJson = await videoRes.json() as { id?: string; error?: { message: string } };
          if (videoJson.id) publishedMediaIds.push(videoJson.id);
          else { mediaFailed = true; }
        } else {
          const photoRes = await fetch(
            `${META_API}/${pageId}/photos?url=${encodeURIComponent(publicUrl)}&access_token=${accessToken}&published=false`,
            { method: "POST" },
          );
          const photoJson = await photoRes.json() as { id?: string; error?: { message: string } };
          if (photoJson.id) publishedMediaIds.push(photoJson.id);
          else { mediaFailed = true; }
        }
      } catch {
        mediaFailed = true;
      }
    }

    const postBody = new URLSearchParams();
    if (post.text) postBody.set("message", post.text);

    if (publishedMediaIds.length > 0) {
      if (publishedMediaIds.length === 1 && !mediaItems[0]?.contentType?.startsWith("video/")) {
        const photoRes = await fetch(
          `${META_API}/${pageId}/photos?url=${encodeURIComponent(mediaItems[0].publicUrl)}&message=${encodeURIComponent(post.text || "")}&access_token=${accessToken}`,
          { method: "POST" },
        );
        const photoJson = await photoRes.json() as { id?: string; error?: { message: string } };
        if (photoJson.id) {
          return {
            success: true,
            platformRef: photoJson.id,
            ...(mediaFailed ? { error: "published (media failed)" } : {}),
          };
        }
        return { success: false, error: photoJson.error?.message || "Photo publish failed" };
      }

      const mediaParams = publishedMediaIds.map((mid) => `media_fbid=${mid}`).join("&");
      const feedUrl = `${META_API}/${pageId}/feed?message=${encodeURIComponent(post.text || "")}&${mediaParams}&access_token=${accessToken}`;
      const feedRes = await fetch(feedUrl, { method: "POST" });
      const feedJson = await feedRes.json() as { id?: string; error?: { message: string } };
      if (feedJson.id) {
        return {
          success: true,
          platformRef: feedJson.id,
          ...(mediaFailed ? { error: "published (media failed)" } : {}),
        };
      }
      return { success: false, error: feedJson.error?.message || "Feed post failed" };
    }

    const feedRes = await fetch(
      `${META_API}/${pageId}/feed?message=${encodeURIComponent(post.text || "")}&access_token=${accessToken}`,
      { method: "POST" },
    );
    const feedJson = await feedRes.json() as { id?: string; error?: { message: string } };
    if (feedJson.id) {
      return { success: true, platformRef: feedJson.id };
    }
    return { success: false, error: feedJson.error?.message || "Feed post failed" };
  }

  async verify(_targetId: string, platformRef: string): Promise<VerifyResult> {
    return { status: "published", platformRef };
  }
}
