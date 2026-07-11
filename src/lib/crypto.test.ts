import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "@/lib/crypto";

describe("AES-256-GCM vault (CONN-03)", () => {
  it("roundtrips plaintext", () => {
    const secret = "meta-access-token-abc123";
    const enc = encrypt(secret);
    expect(decrypt(enc)).toBe(secret);
  });

  it("produces ciphertext that is not the plaintext", () => {
    const secret = "meta-access-token-abc123";
    const enc = encrypt(secret);
    expect(enc.ciphertext).not.toBe(secret);
    expect(enc.ciphertext).not.toContain(secret);
    // base64 ciphertext, separate IV + tag
    expect(enc.iv).toBeTruthy();
    expect(enc.tag).toBeTruthy();
  });

  it("uses a unique IV per encryption", () => {
    const a = encrypt("same");
    const b = encrypt("same");
    expect(a.iv).not.toBe(b.iv);
  });

  it("throws when the ciphertext is tampered (integrity)", () => {
    const enc = encrypt("secret-value");
    const tampered = {
      ...enc,
      ciphertext: enc.ciphertext.slice(0, -2) + "AA",
    };
    expect(() => decrypt(tampered)).toThrow();
  });

  it("never includes plaintext in the encrypted payload object", () => {
    const secret = "do-not-leak-this-token";
    const enc = encrypt(secret);
    const serialized = JSON.stringify(enc);
    expect(serialized).not.toContain(secret);
  });
});
