import type { OAuthProvider, Platform } from "./provider";
import { MockProvider } from "./mock";
import { MetaProvider } from "./meta";
import { LinkedInProvider } from "./linkedin";

/**
 * Factory: returns the mock provider when OAUTH_PROVIDER_MODE=mock (default),
 * otherwise the real Meta/LinkedIn implementations.
 */
export function getProvider(platform: Platform): OAuthProvider {
  const mode = process.env.OAUTH_PROVIDER_MODE ?? "mock";
  if (mode === "mock") {
    return new MockProvider(platform);
  }
  if (platform === "meta") return new MetaProvider();
  return new LinkedInProvider();
}
