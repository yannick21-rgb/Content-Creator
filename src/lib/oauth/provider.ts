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

export interface AuthorizeParams {
  state: string;
  codeChallenge: string;
  redirectUri: string;
}

export interface ExchangeParams {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}

export interface OAuthProvider {
  platform: Platform;
  getAuthorizeUrl(p: AuthorizeParams): string;
  exchangeCode(p: ExchangeParams): Promise<OAuthToken>;
  fetchIdentity(accessToken: string): Promise<OAuthIdentity>;
  getScopes(): string[];
}
