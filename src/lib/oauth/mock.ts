import { randomBytes } from "crypto";
import type { OAuthProvider, OAuthToken, OAuthIdentity, Platform } from "./provider";

// Deterministic mock provider — same interface/state machine as the real
// Meta/LinkedIn providers so the connect flow is provable with zero approved
// app credentials (PITFALL 6). The mock "authorize" handler lives at
// /api/clients/[id]/connections/<platform>/mock-authorize and simply redirects
// back to the callback with a fixed code + the original state.
export class MockOAuthProvider implements OAuthProvider {
  constructor(public platform: Platform) {}

  getScopes(): string[] {
    return ["mock"];
  }

  getAuthorizeUrl(p: { state: string }): string {
    // The start route redirects here; this is where the (mock) provider would
    // ask for consent. It immediately bounces back to the callback.
    return `/api/clients/__PLACEHOLDER__/connections/${this.platform}/mock-authorize?state=${p.state}`;
  }

  async exchangeCode(p: { code: string }): Promise<OAuthToken> {
    if (!p.code.startsWith("MOCK_")) {
      throw new Error("Mock provider expects a MOCK_ code");
    }
    const rand = randomBytes(6).toString("hex");
    return {
      accessToken: `mock-access-${this.platform}-${rand}`,
      refreshToken: `mock-refresh-${this.platform}-${rand}`,
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // +60d
      longLived: true,
    };
  }

  async fetchIdentity(accessToken: string): Promise<OAuthIdentity> {
    const rand = randomBytes(6).toString("hex");
    return {
      platformAccountId: `mock-${this.platform}-id-${rand}`,
      name: `Mock ${this.platform === "meta" ? "Meta" : "LinkedIn"} Account`,
    };
  }

  async refreshToken(p: {
    accessToken: string;
    refreshToken?: string;
  }): Promise<OAuthToken | null> {
    const rand = randomBytes(6).toString("hex");
    return {
      accessToken: `mock-access-${this.platform}-refreshed-${rand}`,
      refreshToken: `mock-refresh-${this.platform}-${rand}`,
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      longLived: true,
    };
  }
}
