import type {
  AuthorizeParams,
  ExchangeParams,
  OAuthIdentity,
  OAuthProvider,
  OAuthToken,
} from "./provider";

const LINKEDIN_AUTH_BASE = "https://www.linkedin.com/oauth/v2/authorization";
const LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const LINKEDIN_SCOPES = ["w_member_social"];

/**
 * Real LinkedIn OAuth provider.
 * Standard access has no refresh token (PITFALL 1) — we store expiresAt and
 * rely on the reconnect flow for renewal.
 */
export class LinkedInProvider implements OAuthProvider {
  platform = "linkedin" as const;

  getAuthorizeUrl(p: AuthorizeParams): string {
    const url = new URL(LINKEDIN_AUTH_BASE);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", process.env.LINKEDIN_CLIENT_ID ?? "");
    url.searchParams.set("redirect_uri", p.redirectUri);
    url.searchParams.set("state", p.state);
    url.searchParams.set("scope", LINKEDIN_SCOPES.join(" "));
    url.searchParams.set("code_challenge", p.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    return url.toString();
  }

  async exchangeCode(p: ExchangeParams): Promise<OAuthToken> {
    const res = await fetch(LINKEDIN_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: p.code,
        redirect_uri: p.redirectUri,
        client_id: process.env.LINKEDIN_CLIENT_ID ?? "",
        client_secret: process.env.LINKEDIN_CLIENT_SECRET ?? "",
        code_verifier: p.codeVerifier,
      }).toString(),
    });
    const json = (await res.json()) as {
      access_token: string;
      expires_in?: number;
      refresh_token?: string;
    };
    if (!json.access_token) throw new Error("LinkedIn token exchange failed");
    const expiresIn = json.expires_in ?? 60 * 24 * 60 * 60;
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    };
  }

  async fetchIdentity(accessToken: string): Promise<OAuthIdentity> {
    const res = await fetch(
      "https://api.linkedin.com/rest/member?projection=(id,localizedLastName)",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "LinkedIn-Version": "202504",
        },
      },
    );
    const json = (await res.json()) as {
      id?: string;
      localizedLastName?: string;
    };
    return {
      platformAccountId: json.id ?? "unknown",
      name: json.localizedLastName
        ? `LinkedIn ${json.localizedLastName}`
        : "LinkedIn Account",
    };
  }

  getScopes(): string[] {
    return LINKEDIN_SCOPES;
  }
}
