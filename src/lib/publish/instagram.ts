import type {
  Publisher, PublishPlatform, PrepareResult, PublishResult,
  VerifyResult, PublishContext,
} from "./provider";

const META_API = "https://graph.facebook.com/v22.0";

export class InstagramPublisher implements Publisher {
  platform: PublishPlatform = "instagram";

  async prepare(post: any, _target: any): Promise<PrepareResult> {
    const errors: string[] = [];
    const mediaItems: any[] = post.media || [];

    if (!post.text && mediaItems.length === 0) {
      errors.push("Post must have text or media");
    }
    if (post.text && post.text.length > 2200) {
      errors.push("Instagram caption exceeds 2,200 character limit");
    }

    if (mediaItems.length === 0) {
      errors.push("IG posts require media");
    }

    if (mediaItems.length === 1) {
      const m = mediaItems[0];
      if (m.contentType && !m.contentType.startsWith("image/") && !m.contentType.startsWith("video/")) {
        errors.push("IG single media must be image or video");
      }
    } else if (mediaItems.length >= 2) {
      if (mediaItems.length > 10) {
        errors.push("IG carousel supports 2-10 items");
      }
      for (const m of mediaItems) {
        if (m.contentType && !m.contentType.startsWith("image/")) {
          errors.push("IG carousel items must be images (JPEG)");
          break;
        }
        if (!m.publicUrl) {
          errors.push("Carousel item missing public URL");
        }
      }
    }

    return { ready: errors.length === 0, errors: errors.length ? errors : undefined };
  }

  async publish(post: any, target: any, context: PublishContext): Promise<PublishResult> {
    const { accessToken } = context;
    const igUserId = target.socialAccount?.platformAccountId || context.igUserId;
    if (!igUserId) return { success: false, error: "No IG user ID in target" };

    const mediaItems: any[] = post.media || [];
    const caption = post.text || "";

    if (mediaItems.length === 0) {
      return { success: false, error: "IG posts require media" };
    }

    if (mediaItems.length === 1) {
      const m = mediaItems[0];
      const isVideo = m.contentType?.startsWith("video/");
      const mediaType = isVideo ? "VIDEO" : "IMAGE";

      const createBody = new URLSearchParams();
      createBody.set("media_type", mediaType);
      if (isVideo) {
        createBody.set("video_url", m.publicUrl);
      } else {
        createBody.set("image_url", m.publicUrl);
      }
      if (caption) createBody.set("caption", caption);

      const createRes = await fetch(
        `${META_API}/${igUserId}/media?access_token=${accessToken}`,
        { method: "POST", body: createBody },
      );
      const createJson = await createRes.json() as { id?: string; error?: { message: string } };
      if (!createJson.id) {
        return { success: false, error: createJson.error?.message || "IG container creation failed" };
      }

      const containerId = createJson.id;
      await new Promise((r) => setTimeout(r, 5000));

      const publishRes = await fetch(
        `${META_API}/${igUserId}/media_publish?creation_id=${containerId}&access_token=${accessToken}`,
        { method: "POST" },
      );
      const publishJson = await publishRes.json() as { id?: string; error?: { message: string } };
      if (publishJson.id) {
        return { success: true, platformRef: publishJson.id };
      }
      return { success: false, error: publishJson.error?.message || "IG publish failed" };
    }

    const childContainerIds: string[] = [];
    for (const m of mediaItems) {
      const childBody = new URLSearchParams();
      childBody.set("media_type", "IMAGE");
      childBody.set("image_url", m.publicUrl);
      childBody.set("is_carousel_item", "true");

      const childRes = await fetch(
        `${META_API}/${igUserId}/media?access_token=${accessToken}`,
        { method: "POST", body: childBody },
      );
      const childJson = await childRes.json() as { id?: string; error?: { message: string } };
      if (!childJson.id) {
        return { success: false, error: `Child container failed: ${childJson.error?.message || "unknown"}` };
      }
      childContainerIds.push(childJson.id);
    }

    await new Promise((r) => setTimeout(r, 5000));

    const carouselBody = new URLSearchParams();
    carouselBody.set("media_type", "CAROUSEL");
    carouselBody.set("children", childContainerIds.join(","));
    if (caption) carouselBody.set("caption", caption);

    const carouselRes = await fetch(
      `${META_API}/${igUserId}/media?access_token=${accessToken}`,
      { method: "POST", body: carouselBody },
    );
    const carouselJson = await carouselRes.json() as { id?: string; error?: { message: string } };
    if (!carouselJson.id) {
      return { success: false, error: carouselJson.error?.message || "Carousel container failed" };
    }

    await new Promise((r) => setTimeout(r, 5000));

    const publishRes = await fetch(
      `${META_API}/${igUserId}/media_publish?creation_id=${carouselJson.id}&access_token=${accessToken}`,
      { method: "POST" },
    );
    const publishJson = await publishRes.json() as { id?: string; error?: { message: string } };
    if (publishJson.id) {
      return { success: true, platformRef: publishJson.id };
    }
    return { success: false, error: publishJson.error?.message || "IG carousel publish failed" };
  }

  async verify(_targetId: string, platformRef: string): Promise<VerifyResult> {
    return { status: "published", platformRef };
  }
}
