import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@refri/config";
import { randomUUID } from "node:crypto";

function createS3Client(endpoint: string) {
  return new S3Client({
    region: env.MINIO_REGION,
    endpoint,
    forcePathStyle: env.MINIO_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.MINIO_ACCESS_KEY,
      secretAccessKey: env.MINIO_SECRET_KEY
    }
  });
}

export async function createUploadUrl(
  params: { kind: "photo" | "audio"; contentType: string },
  endpointOverride?: string
) {
  const ext = params.contentType.split("/")[1] ?? "bin";
  const objectKey = `${params.kind}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: env.MINIO_BUCKET,
    Key: objectKey,
    ContentType: params.contentType
  });

  const endpoint = endpointOverride ?? env.MINIO_PUBLIC_ENDPOINT ?? env.MINIO_ENDPOINT;
  const s3 = createS3Client(endpoint);
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 60 * 10 });
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  return {
    uploadUrl,
    objectKey,
    expiresAt
  };
}
