"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getS3Client() {
  return new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

const BUCKET = () => process.env.S3_BUCKET!;

export const getUploadUrl = action({
  args: {
    recordingId: v.id("recordings"),
    contentType: v.string(),
  },
  handler: async (_ctx, args) => {
    const s3Key = `recordings/${args.recordingId}.webm`;
    const client = getS3Client();

    const command = new PutObjectCommand({
      Bucket: BUCKET(),
      Key: s3Key,
      ContentType: args.contentType,
    });

    // URL valid for 1 hour — enough for large uploads
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 3600 });

    return { uploadUrl, s3Key };
  },
});

export const getDownloadUrl = action({
  args: {
    s3Key: v.string(),
  },
  handler: async (_ctx, args) => {
    const client = getS3Client();

    const command = new GetObjectCommand({
      Bucket: BUCKET(),
      Key: args.s3Key,
    });

    // URL valid for 1 hour
    return await getSignedUrl(client, command, { expiresIn: 3600 });
  },
});
