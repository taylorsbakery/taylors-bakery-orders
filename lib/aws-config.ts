import { S3Client } from '@aws-sdk/client-s3';

export function getBucketConfig() {
  return {
    bucketName: process.env.AWS_BUCKET_NAME ?? '',
    folderPrefix: process.env.AWS_FOLDER_PREFIX ?? '',
  };
}

export function createS3Client() {
  return new S3Client({});
}

// Legacy exports for backward compatibility
export const s3Client = createS3Client();
export const BUCKET_NAME = process.env.AWS_BUCKET_NAME || '';
export const FOLDER_PREFIX = process.env.AWS_FOLDER_PREFIX || '';
