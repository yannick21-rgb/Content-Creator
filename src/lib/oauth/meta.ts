import type { OAuthProvider, OAuthToken, OAuthIdentity } from "./provider";

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
      // @ts-expect-error URLSearchParams is accepted as body
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
    // Fetch the linked Instagram Business account / Page id.
    const res = await fetch(
      `${META_API}/me/accounts?fields=id,name,instagram_business_account{id,username}&access_token=${accessToken}`,
    );
    const json = (await res.json()) as {
      data?: Array<{
        id: string;
        name: string;
        instagram_business_account?: { id: string; username?: string };
      }>;
    };
    const page = json.data?.[0];
    if (!page) throw new Error("No Meta page found for token");
    return {
      platformAccountId: page.instagram_business_account?.id ?? page.id,
      name: page.instagram_business_account?.username ?? page.name,
    };
  }
}
