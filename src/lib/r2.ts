// src/lib/r2.ts
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { S3RequestPresigner } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

const client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const presigner = new S3RequestPresigner({ ...client });

async function generateUploadUrl({
  clientId,
  contentType,
  fileName,
  userId,
}: {
  clientId: string;
  contentType: string;
  fileName: string;
  userId: string;
}) {
  const ext = fileName.split('.').pop() || '';
  const key = `media/${clientId}/${randomUUID()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
    ContentType: contentType,
    ACL: 'public-read',
    Metadata: {
      client_id: clientId,
      user_id: userId,
    },
  });

  const presignedUrl = await presigner.presign(command, { expiresIn: 3600 });
  return {
    presignedUrl,
    key,
    clientId,
    contentType,
  };
}

export { generateUploadUrl };
