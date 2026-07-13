import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("TOKEN_ENCRYPTION_KEY is not set");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must decode to 32 bytes");
  }
  return key;
}

export interface EncryptedPayload {
  iv: string;
  tag: string;
  ciphertext: string;
}

// Encrypt a plaintext token. IV is unique per encryption; auth tag verified on
// decrypt. Plaintext is never persisted or logged.
export function encrypt(plainText: string): EncryptedPayload {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ct = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ct.toString("base64"),
  };
}

// Encrypt access + refresh tokens, each with its own IV/tag (required for GCM
// correctness). Returns all fields needed to persist and later decrypt both.
export function encryptTokenPair(
  accessToken: string,
  refreshToken?: string | null,
): {
  accessTokenEnc: string;
  iv: string;
  tag: string;
  refreshTokenEnc: string | null;
  refreshTokenIv: string | null;
  refreshTokenTag: string | null;
} {
  const access = encrypt(accessToken);
  if (!refreshToken) {
    return {
      accessTokenEnc: access.ciphertext,
      iv: access.iv,
      tag: access.tag,
      refreshTokenEnc: null,
      refreshTokenIv: null,
      refreshTokenTag: null,
    };
  }
  const refresh = encrypt(refreshToken);
  return {
    accessTokenEnc: access.ciphertext,
    iv: access.iv,
    tag: access.tag,
    refreshTokenEnc: refresh.ciphertext,
    refreshTokenIv: refresh.iv,
    refreshTokenTag: refresh.tag,
  };
}

export function decrypt({ iv, tag, ciphertext }: EncryptedPayload): string {
  const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64")),
    decipher.final(),
  ]);
  return pt.toString("utf8");
}
