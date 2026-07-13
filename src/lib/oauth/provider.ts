export type Platform = "meta" | "linkedin" | "instagram";

export interface OAuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  longLived?: boolean;
}

export interface OAuthIdentity {
  platformAccountId: string;
  name: string;
}

export interface OAuthProvider {
  platform: Platform;
  getScopes(): string[];
  // Returns a redirect URL the browser should be sent to.
  getAuthorizeUrl(p: {
    state: string;
    codeChallenge: string;
    redirectUri: string;
  }): string;
  exchangeCode(p: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<OAuthToken>;
  fetchIdentity(accessToken: string): Promise<OAuthIdentity>;
  // Refresh an access token. `accessToken` is always provided (Meta long-lived
  // tokens are refreshed by re-exchanging the current token); `refreshToken` is
  // used by providers with a standard refresh grant (LinkedIn). Returns null if
  // the token cannot be refreshed (e.g. expired beyond the refresh window).
  refreshToken(p: {
    accessToken: string;
    refreshToken?: string;
    platform?: Platform;
    platformAccountId?: string;
  }): Promise<OAuthToken | null>;
}
