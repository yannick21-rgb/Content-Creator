import type { Publisher, PublishPlatform } from "./provider";
import { FakePublisher } from "./fake";
import { MetaPublisher } from "./meta";
import { InstagramPublisher } from "./instagram";
import { LinkedInPublisher } from "./linkedin";

export function getPublisher(platform?: PublishPlatform): Publisher {
  const mode = process.env.PUBLISHER_MODE ?? "fake";
  if (mode === "real") {
    if (platform === "meta") return new MetaPublisher();
    if (platform === "instagram") return new InstagramPublisher();
    if (platform === "linkedin") return new LinkedInPublisher();
    return new FakePublisher(platform);
  }
  return new FakePublisher(platform ?? "fake");
}
