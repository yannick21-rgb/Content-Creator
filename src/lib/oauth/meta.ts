import type {
  AuthorizeParams,
  ExchangeParams,
  OAuthIdentity,
  OAuthProvider,
  OAuthToken,
} from "./provider";

const META_AUTH_BASE = "https://www.facebook.com/v22.0/dialog/oauth";
const META_TOKEN_URL = "https://graph.facebook.com/v22.0/oauth/access_token";
const META_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
  "pages_show_list",
  "pages_read_engagement",
];

/**
 * Real Meta (Facebook/Instagram) OAuth provider.
 * exchangeCode performs the short→long-lived token swap (PITFALL 2) before
 * returning, so only a 60-day token is ever persisted.
 */
export class MetaProvider implements OAuthProvider {
  platform = "meta" as const;

  getAuthorizeUrl(p: AuthorizeParams): string {
    const clientId = process.env.META_CLIENT_ID;
    const url = new URL(META_AUTH_BASE);
    url.searchParams.set("client_id", clientId ?? "");
    url.searchParams.set("redirect_uri", p.redirectUri);
    url.searchParams.set("state", p.state);
    url.searchParams.set("scope", META_SCOPES.join(","));
    url.searchParams.set("code_challenge", p.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    return url.toString();
  }

  async exchangeCode(p: ExchangeParams): Promise<OAuthToken> {
    // 1) short-lived token
    const shortRes = await fetch(META_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.META_CLIENT_ID,
        client_secret: process.env.META_CLIENT_SECRET,
        code: p.code,
        redirect_uri: p.redirectUri,
        code_verifier: p.codeVerifier,
      }),
    });
    const shortJson = (await shortRes.json()) as {
      access_token: string;
      expires_in?: number;
    };
    if (!shortJson.access_token) {
      throw new Error("Meta token exchange failed");
    }

    // 2) long-lived (60d) exchange
    const longRes = await fetch(META_TOKEN_URL, {
      method: "GET",
      headers: { "content-type": "application/json" },
    });
    const longUrl = new URL(META_TOKEN_URL);
    longUrl.searchParams.set("grant_type", "fb_exchange_token");
    longUrl.searchParams.set("client_id", process.env.META_CLIENT_ID ?? "");
    longUrl.searchParams.set("client_secret", process.env.META_CLIENT_SECRET ?? "");
    longUrl.searchParams.set("fb_exchange_token", shortJson.access_token);
    const longFetch = await fetch(longUrl.toString());
    const longJson = (await longFetch.json()) as {
      access_token: string;
      expires_in?: number;
    };

    const expiresIn = longJson.expires_in ?? shortJson.expires_in ?? 60 * 24 * 60 * 60;
    return {
      accessToken: longJson.access_token ?? shortJson.access_token,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      longLived: true,
    };
  }

  async fetchIdentity(accessToken: string): Promise<OAuthIdentity> {
    const res = await fetch(
      "https://graph.facebook.com/v22.0/me/accounts?fields=id,name,instagram_business_account{id,username}",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const json = (await res.json()) as {
      id?: string;
      name?: string;
      instagram_business_account?: { id?: string; username?: string };
    };
    const platformAccountId =
      json.instagram_business_account?.id ?? json.id ?? "unknown";
    return {
      platformAccountId,
      name: json.instagram_business_account?.username ?? json.name ?? "Meta Account",
    };
  }

  getScopes(): string[] {
    return META_SCOPES;
  }
}
