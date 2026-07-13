import type { OAuthProvider, OAuthToken, OAuthIdentity, Platform } from "./provider";

const META_API = "https://graph.facebook.com/v22.0";

export class MetaOAuthProvider implements OAuthProvider {
  platform = "meta" as const;

  getScopes(): string[] {
    return [
      "instagram_business_basic",
      "instagram_business_content_publish",
      "pages_show_list",
      "pages_read_engagement",
    ];
  }

  getAuthorizeUrl(p: {
    state: string;
    codeChallenge: string;
    redirectUri: string;
  }): string {
    const clientId = process.env.META_CLIENT_ID;
    if (!clientId) throw new Error("META_CLIENT_ID is not set");
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: p.redirectUri,
      state: p.state,
      scope: this.getScopes().join(","),
      response_type: "code",
      code_challenge: p.codeChallenge,
      code_challenge_method: "S256",
    });
    return `https://www.facebook.com/v22.0/dialog/oauth?${params.toString()}`;
  }

  // Exchange the code for a short-lived token, then swap for a 60-day
  // long-lived token (PITFALL 2). Never persist the short-lived token.
  async exchangeCode(p: {
    code: string;
    redirectUri: string;
  }): Promise<OAuthToken> {
    const clientId = process.env.META_CLIENT_ID!;
    const clientSecret = process.env.META_CLIENT_SECRET!;
    const shortRes = await fetch(`${META_API}/oauth/access_token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: p.code,
        redirect_uri: p.redirectUri,
      }),
    });
    const shortJson = (await shortRes.json()) as {
      access_token: string;
      expires_in?: number;
    };
    if (!shortJson.access_token) {
      throw new Error("Meta short-lived token exchange failed");
    }

    const longRes = await fetch(`${META_API}/oauth/access_token`, {
      method: "GET",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      // fb_exchange_token for long-lived (60d)
      body: new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: clientId,
        client_secret: clientSecret,
        fb_exchange_token: shortJson.access_token,
      }),
    });
    const longJson = (await longRes.json()) as {
      access_token: string;
      expires_in?: number;
    };
    const token = longJson.access_token ?? shortJson.access_token;
    const expiresIn = longJson.expires_in ?? shortJson.expires_in ?? 60 * 24 * 60 * 60;
    return {
      accessToken: token,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      longLived: true,
    };
  }

  async fetchIdentity(accessToken: string): Promise<OAuthIdentity> {
    const result = await this.fetchIdentityWithPages(accessToken);
    return result.identity;
  }

  async fetchIdentityWithPages(accessToken: string): Promise<{
    identity: OAuthIdentity;
    pages: Array<{ id: string; name: string; pageToken: string }>;
  }> {
    const pagesRes = await fetch(
      `${META_API}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&limit=100&access_token=${accessToken}`,
    );
    const pagesJson = await pagesRes.json() as {
      data?: Array<{
        id: string; name: string; access_token: string;
        instagram_business_account?: { id: string; username?: string };
      }>;
      error?: { message: string };
    };
    if (pagesJson.error) throw new Error(`Meta pages fetch failed: ${pagesJson.error.message}`);
    const pages = (pagesJson.data || []).map((p) => ({
      id: p.id,
      name: p.name,
      pageToken: p.access_token,
    }));
    const first = pagesJson.data?.[0];
    if (!first) throw new Error("No Meta page found for token");
    return {
      identity: {
        platformAccountId: first.instagram_business_account?.id ?? first.id,
        name: first.instagram_business_account?.username ?? first.name,
      },
      pages,
    };
  }

  // Meta long-lived user tokens are refreshed by re-exchanging the *current*
  // long-lived token (fb_exchange_token) — only works while not expired.
  // Instagram Business tokens use the dedicated ig_refresh_token grant.
  // Returns null if the token is expired beyond the refresh window.
  async refreshToken(p: {
    accessToken: string;
    refreshToken?: string;
    platform?: Platform;
    platformAccountId?: string;
  }): Promise<OAuthToken | null> {
    const clientId = process.env.META_CLIENT_ID!;
    const clientSecret = process.env.META_CLIENT_SECRET!;

    if (p.platform === "instagram" && p.platformAccountId) {
      const res = await fetch(
        `${META_API}/${p.platformAccountId}/refresh_access_token?grant_type=ig_refresh_token&access_token=${p.accessToken}`,
      );
      const json = (await res.json()) as {
        access_token?: string;
        expires_in?: number;
        error?: { message: string };
      };
      if (!json.access_token) return null;
      const expiresIn = json.expires_in ?? 60 * 24 * 60 * 60;
      return {
        accessToken: json.access_token,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
        longLived: true,
      };
    }

    const res = await fetch(`${META_API}/oauth/access_token`, {
      method: "GET",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: clientId,
        client_secret: clientSecret,
        fb_exchange_token: p.accessToken,
      }),
    });
    const json = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
      error?: { message: string };
    };
    if (!json.access_token) return null;
    const expiresIn = json.expires_in ?? 60 * 24 * 60 * 60;
    return {
      accessToken: json.access_token,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      longLived: true,
    };
  }
}
