import { randomBytes, createHash } from "crypto";

export interface Pkce {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
}

// RFC 7636 PKCE: S256 challenge derived from a random verifier.
export function generatePkce(): Pkce {
  const state = randomBytes(16).toString("hex");
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  return { state, codeVerifier, codeChallenge };
}
