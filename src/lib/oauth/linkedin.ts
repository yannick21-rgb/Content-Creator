import type { OAuthProvider, OAuthToken, OAuthIdentity } from "./provider";

const LINKEDIN_API = "https://api.linkedin.com/rest";

export class LinkedInOAuthProvider implements OAuthProvider {
  platform = "linkedin" as const;

  getScopes(): string[] {
    return ["w_member_social"];
  }

  getAuthorizeUrl(p: {
    state: string;
    codeChallenge: string;
    redirectUri: string;
  }): string {
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    if (!clientId) throw new Error("LINKEDIN_CLIENT_ID is not set");
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: p.redirectUri,
      state: p.state,
      scope: this.getScopes().join(" "),
      code_challenge: p.codeChallenge,
      code_challenge_method: "S256",
    });
    return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
  }

  // LinkedIn returns a ~60-day token; standard access has NO refresh token
  // (PITFALL 1) — design for re-auth, never assume refresh.
  async exchangeCode(p: {
    code: string;
    redirectUri: string;
  }): Promise<OAuthToken> {
    const clientId = process.env.LINKEDIN_CLIENT_ID!;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET!;
    const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: p.code,
        redirect_uri: p.redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    const json = (await res.json()) as {
      access_token: string;
      expires_in?: number;
      refresh_token?: string;
    };
    if (!json.access_token) {
      throw new Error("LinkedIn token exchange failed");
    }
    const expiresIn = json.expires_in ?? 60 * 24 * 60 * 60;
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      longLived: false,
    };
  }

  // LinkedIn supports the standard refresh_token grant. Returns null if no
  // refresh token is available (re-auth required).
  async refreshToken(p: {
    accessToken: string;
    refreshToken?: string;
  }): Promise<OAuthToken | null> {
    if (!p.refreshToken) return null;
    const clientId = process.env.LINKEDIN_CLIENT_ID!;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET!;
    const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: p.refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    const json = (await res.json()) as {
      access_token: string;
      expires_in?: number;
      refresh_token?: string;
    };
    if (!json.access_token) return null;
    const expiresIn = json.expires_in ?? 60 * 24 * 60 * 60;
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      longLived: false,
    };
  }

  async fetchIdentity(accessToken: string): Promise<OAuthIdentity> {
    const res = await fetch(
      `${LINKEDIN_API}/member?projection=(id,localizedLastName)`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "LinkedIn-Version": "202405",
        },
      },
    );
    const json = (await res.json()) as { id: string; localizedLastName?: string };
    if (!json.id) throw new Error("No LinkedIn profile found for token");
    return {
      platformAccountId: json.id,
      name: json.localizedLastName
        ? `LinkedIn ${json.localizedLastName}`
        : "LinkedIn Account",
    };
  }
}
