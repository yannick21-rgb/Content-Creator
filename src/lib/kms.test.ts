import { describe, it, expect, beforeEach } from "vitest";
import { LocalKmsProvider, MockKmsProvider, encryptWithEnvelope, decryptWithEnvelope, createKmsProvider } from "./kms";

const TEST_KEY = "LHMNZSqIaK2POOPdwA/rFBaercbC64nUOdUW9UqADDA=";

describe("LocalKmsProvider", () => {
  beforeEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY;
    process.env.KMS_MODE = "local";
  });

  it("generates a data key and decrypts it", async () => {
    const provider = new LocalKmsProvider();
    const { plaintext, wrapped } = await provider.generateDataKey();
    expect(plaintext.length).toBe(32);
    expect(wrapped.ciphertext).toBeTruthy();
    expect(wrapped.iv).toBeTruthy();
    expect(wrapped.tag).toBeTruthy();
    expect(wrapped.keyVersion).toBe("v1");

    const decrypted = await provider.decryptDataKey(wrapped);
    expect(decrypted).toEqual(plaintext);
  });
});

describe("MockKmsProvider", () => {
  it("returns a deterministic key", async () => {
    const provider = new MockKmsProvider();
    const { plaintext, wrapped } = await provider.generateDataKey();
    expect(plaintext.toString()).toBe("0123456789abcdef0123456789abcdef");
    expect(wrapped.keyVersion).toBe("mock-v1");
  });

  it("decrypts to the mock key", async () => {
    const provider = new MockKmsProvider();
    const key = await provider.decryptDataKey({
      ciphertext: "any",
      iv: "any",
      tag: "any",
      keyVersion: "mock-v1",
    });
    expect(key.toString()).toBe("0123456789abcdef0123456789abcdef");
  });
});

describe("envelope encryption roundtrip", () => {
  beforeEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY;
    process.env.KMS_MODE = "local";
  });

  it("encrypts and decrypts a token", async () => {
    const token = "EAATestAccessToken123";
    const { encrypted, wrappedKey } = await encryptWithEnvelope(token);

    expect(encrypted.ciphertext).not.toBe(token);
    expect(encrypted.iv).toBeTruthy();
    expect(encrypted.tag).toBeTruthy();

    const decrypted = await decryptWithEnvelope(encrypted, wrappedKey);
    expect(decrypted).toBe(token);
  });

  it("produces different ciphertexts for the same plaintext", async () => {
    const token = "same-token";
    const r1 = await encryptWithEnvelope(token);
    const r2 = await encryptWithEnvelope(token);
    expect(r1.encrypted.ciphertext).not.toBe(r2.encrypted.ciphertext);
  });
});

describe("createKmsProvider", () => {
  beforeEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY;
  });

  it("creates a LocalKmsProvider when KMS_MODE=local", () => {
    process.env.KMS_MODE = "local";
    const p = createKmsProvider();
    expect(p).toBeInstanceOf(LocalKmsProvider);
  });

  it("creates a MockKmsProvider when KMS_MODE=mock", () => {
    process.env.KMS_MODE = "mock";
    const p = createKmsProvider();
    expect(p).toBeInstanceOf(MockKmsProvider);
  });

  it("throws for unknown KMS_MODE", () => {
    process.env.KMS_MODE = "aws";
    expect(() => createKmsProvider()).toThrow("Unknown KMS_MODE: aws");
  });
});
