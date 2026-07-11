import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "@/lib/crypto";

describe("crypto (AES-256-GCM)", () => {
  it("roundtrips plaintext", () => {
    const secret = "meta-access-token-abc123";
    const enc = encrypt(secret);
    expect(decrypt(enc)).toBe(secret);
  });

  it("produces ciphertext different from plaintext", () => {
    const secret = "meta-access-token-abc123";
    const enc = encrypt(secret);
    expect(enc.ciphertext).not.toBe(secret);
    expect(Buffer.from(enc.ciphertext, "base64").toString("utf8")).not.toContain(
      secret,
    );
  });

  it("uses a per-encryption IV", () => {
    const a = encrypt("same-input");
    const b = encrypt("same-input");
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("fails to decrypt with the wrong key", () => {
    const enc = encrypt("secret-data");
    process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    expect(() => decrypt(enc)).toThrow();
  });

  it("emits no plaintext in the encrypted payload object", () => {
    const secret = "super-secret-token";
    const enc = encrypt(secret);
    expect(JSON.stringify(enc)).not.toContain(secret);
  });
});
