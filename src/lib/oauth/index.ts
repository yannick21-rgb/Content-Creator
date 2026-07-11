import type { OAuthProvider, Platform } from "./provider";
import { MockOAuthProvider } from "./mock";
import { MetaOAuthProvider } from "./meta";
import { LinkedInOAuthProvider } from "./linkedin";

// Factory: returns the mock provider (default, no approved app needed) unless
// OAUTH_PROVIDER_MODE=real and the platform has credentials configured.
export function getProvider(platform: Platform): OAuthProvider {
  const mode = process.env.OAUTH_PROVIDER_MODE ?? "mock";
  if (mode === "real") {
    if (platform === "meta") return new MetaOAuthProvider();
    return new LinkedInOAuthProvider();
  }
  return new MockOAuthProvider(platform);
}
