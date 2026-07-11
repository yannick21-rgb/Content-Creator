import { randomBytes } from "crypto";
import type {
  AuthorizeParams,
  ExchangeParams,
  OAuthIdentity,
  OAuthProvider,
  OAuthToken,
  Platform,
} from "./provider";

/**
 * Dev mock provider — implements the exact same interface/state machine as the
 * real Meta/LinkedIn providers so the full connect→encrypt→persist→"connected"
 * path is provable with zero approved-app credentials (PITFALL 6).
 */
export class MockProvider implements OAuthProvider {
  platform: Platform;

  constructor(platform: Platform) {
    this.platform = platform;
  }

  getAuthorizeUrl(p: AuthorizeParams): string {
    // In mock mode the start route redirects to the mock-authorize handler
    // instead; this URL is only used if the interface is invoked directly.
    return `${p.redirectUri}?code=MOCK_${this.platform}_CODE&state=${p.state}`;
  }

  async exchangeCode(_p: ExchangeParams): Promise<OAuthToken> {
    const rand = randomBytes(6).toString("hex");
    return {
      accessToken: `mock-access-${this.platform}-${rand}`,
      refreshToken: `mock-refresh-${this.platform}-${rand}`,
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      longLived: true,
    };
  }

  async fetchIdentity(_accessToken: string): Promise<OAuthIdentity> {
    const rand = randomBytes(6).toString("hex");
    return {
      platformAccountId: `mock-${this.platform}-id-${rand}`,
      name: `Mock ${this.platform === "meta" ? "Meta" : "LinkedIn"} Account`,
    };
  }

  getScopes(): string[] {
    return [];
  }
}
