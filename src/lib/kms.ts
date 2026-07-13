import { randomBytes, createCipheriv, createDecipheriv } from "crypto";
import type { EncryptedPayload } from "./crypto";

const ALGO = "aes-256-gcm";
const LOCAL_KEK_ALGO = "aes-256-gcm";

export interface WrappedKey {
  ciphertext: string;
  iv: string;
  tag: string;
  keyVersion: string;
}

export interface KmsProvider {
  generateDataKey(): Promise<{ plaintext: Buffer; wrapped: WrappedKey }>;
  decryptDataKey(wrapped: WrappedKey): Promise<Buffer>;
}

export function createKmsProvider(): KmsProvider {
  const mode = process.env.KMS_MODE ?? "local";

  switch (mode) {
    case "local":
      return new LocalKmsProvider();
    case "mock":
      return new MockKmsProvider();
    default:
      throw new Error(`Unknown KMS_MODE: ${mode}`);
  }
}

function getKek(): { key: Buffer; version: string } {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("TOKEN_ENCRYPTION_KEY is not set");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must decode to 32 bytes");
  return { key, version: "v1" };
}

export class LocalKmsProvider implements KmsProvider {
  async generateDataKey(): Promise<{ plaintext: Buffer; wrapped: WrappedKey }> {
    const { key, version } = getKek();
    const dataKey = randomBytes(32);
    const iv = randomBytes(12);
    const cipher = createCipheriv(LOCAL_KEK_ALGO, key, iv);
    const ct = Buffer.concat([cipher.update(dataKey), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      plaintext: dataKey,
      wrapped: {
        ciphertext: ct.toString("base64"),
        iv: iv.toString("base64"),
        tag: tag.toString("base64"),
        keyVersion: version,
      },
    };
  }

  async decryptDataKey(wrapped: WrappedKey): Promise<Buffer> {
    const { key } = getKek();
    const decipher = createDecipheriv(
      LOCAL_KEK_ALGO,
      key,
      Buffer.from(wrapped.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(wrapped.tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(wrapped.ciphertext, "base64")),
      decipher.final(),
    ]);
  }
}

export class MockKmsProvider implements KmsProvider {
  async generateDataKey(): Promise<{ plaintext: Buffer; wrapped: WrappedKey }> {
    const plaintext = Buffer.from("0123456789abcdef0123456789abcdef", "utf8");
    return {
      plaintext,
      wrapped: {
        ciphertext: "",
        iv: "",
        tag: "",
        keyVersion: "mock-v1",
      },
    };
  }

  async decryptDataKey(_wrapped: WrappedKey): Promise<Buffer> {
    return Buffer.from("0123456789abcdef0123456789abcdef", "utf8");
  }
}

export async function encryptWithEnvelope(
  plainText: string,
  provider?: KmsProvider,
): Promise<{ encrypted: EncryptedPayload; wrappedKey: WrappedKey }> {
  const kms = provider ?? createKmsProvider();
  const { plaintext: dataKey, wrapped } = await kms.generateDataKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, dataKey, iv);
  const ct = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    encrypted: {
      iv: iv.toString("base64"),
      tag: tag.toString("base64"),
      ciphertext: ct.toString("base64"),
    },
    wrappedKey: wrapped,
  };
}

export async function decryptWithEnvelope(
  encrypted: EncryptedPayload,
  wrappedKey: WrappedKey,
  provider?: KmsProvider,
): Promise<string> {
  const kms = provider ?? createKmsProvider();
  const dataKey = await kms.decryptDataKey(wrappedKey);
  const decipher = createDecipheriv(ALGO, dataKey, Buffer.from(encrypted.iv, "base64"));
  decipher.setAuthTag(Buffer.from(encrypted.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
