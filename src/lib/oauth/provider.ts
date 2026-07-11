export type Platform = "meta" | "linkedin";

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
}
