import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getBucketConfig, createS3Client } from './aws-config';

const s3Client = createS3Client();

export async function generatePresignedUploadUrl(
  fileName: string,
  contentType: string,
  isPublic: boolean = true
): Promise<{ uploadUrl: string; cloudStoragePath: string; publicUrl: string }> {
  const { bucketName, folderPrefix } = getBucketConfig();
  const region = process.env.AWS_REGION || 'us-west-2';

  // Use correct key pattern per guidelines
  const cloud_storage_path = isPublic
    ? `${folderPrefix}public/uploads/${Date.now()}-${fileName}`
    : `${folderPrefix}uploads/${Date.now()}-${fileName}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: cloud_storage_path,
    ContentType: contentType,
    // CRITICAL: ContentDisposition must be set for public files
    ContentDisposition: isPublic ? 'attachment' : undefined,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
  const publicUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${cloud_storage_path}`;

  return { uploadUrl, cloudStoragePath: cloud_storage_path, publicUrl };
}

export function getPublicUrl(cloudStoragePath: string): string {
  const { bucketName } = getBucketConfig();
  const region = process.env.AWS_REGION || 'us-west-2';
  return `https://${bucketName}.s3.${region}.amazonaws.com/${cloudStoragePath}`;
}

export async function getFileUrl(cloudStoragePath: string, isPublic: boolean): Promise<string> {
  const { bucketName } = getBucketConfig();
  const region = process.env.AWS_REGION || 'us-west-2';

  if (isPublic) {
    return `https://${bucketName}.s3.${region}.amazonaws.com/${cloudStoragePath}`;
  }

  // Generate signed URL for private files
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: cloudStoragePath,
    ResponseContentDisposition: 'attachment',
  });
  return getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

export async function deleteFile(cloudStoragePath: string): Promise<void> {
  const { bucketName } = getBucketConfig();
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: cloudStoragePath,
  });
  await s3Client.send(command);
}
