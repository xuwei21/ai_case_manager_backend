import { Client } from 'minio';
import sharp from 'sharp';
import appConfig from '../config';

let minioClient: Client | null = null;

/**
 * 初始化 MinIO 客户端
 */
export function initMinio(): Client {
  if (minioClient) return minioClient;

  const { endPoint, port, useSSL, accessKey, secretKey } = appConfig.minio;
  minioClient = new Client({
    endPoint,
    port,
    useSSL,
    accessKey,
    secretKey,
  });

  console.log(`[MinIO] Client initialized: ${endPoint}:${port}`);
  return minioClient;
}

/**
 * 确保存储桶存在，不存在则创建并设为公开读
 */
export async function ensureBucket(): Promise<void> {
  const client = initMinio();
  const bucket = appConfig.minio.bucket;

  try {
    const exists = await client.bucketExists(bucket);
    if (!exists) {
      await client.makeBucket(bucket);
      console.log(`[MinIO] Bucket "${bucket}" created`);

      // 设置公开读取策略
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${bucket}/*`],
          },
        ],
      };
      await client.setBucketPolicy(bucket, JSON.stringify(policy));
      console.log(`[MinIO] Public read policy set for bucket "${bucket}"`);
    }
  } catch (err: any) {
    console.error(`[MinIO] ensureBucket error: ${err.message}`);
    throw err;
  }
}

/**
 * 压缩 Base64 截图并返回 JPEG Buffer
 */
export async function compressScreenshot(base64Data: string): Promise<Buffer> {
  const matches = base64Data.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid base64 image format');
  }

  const buffer = Buffer.from(matches[2], 'base64');
  const { maxWidth, jpegQuality } = appConfig.screenshot;

  return sharp(buffer)
    .resize({ width: maxWidth, withoutEnlargement: true })
    .jpeg({ quality: jpegQuality })
    .toBuffer();
}

export async function uploadGeneralImage(
  base64Data: string,
  prefix: string = 'common'
): Promise<{ url: string; objectName: string }> {
  const client = initMinio();
  const bucket = appConfig.minio.bucket;
  const compressedBuffer = await compressScreenshot(base64Data);
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const objectName = `${prefix}/${timestamp}_${random}.jpg`;
  await client.putObject(bucket, objectName, compressedBuffer, compressedBuffer.length, {
    'Content-Type': 'image/jpeg',
  });
  const publicUrl = `${appConfig.minio.publicBaseUrl}/${bucket}/${objectName}`;
  console.log(`[MinIO] General image uploaded: ${publicUrl}`);
  return { url: publicUrl, objectName };
}

/**
 * 上传截图到 MinIO，返回公开访问 URL
 * @param base64Data - 包含前缀的 Base64 字符串 (data:image/png;base64,xxxx)
 * @param taskId - 任务 ID
 * @param caseId - 用例 ID
 * @param stepIndex - 步骤索引
 */
export async function uploadScreenshot(
  base64Data: string,
  taskId: string,
  caseId: string,
  stepIndex: number
): Promise<string> {
  const client = initMinio();
  const bucket = appConfig.minio.bucket;

  // 压缩图片
  const compressedBuffer = await compressScreenshot(base64Data);

  // 对象路径：tasks/{taskId}/{caseId}/step_{stepIndex}_{timestamp}.jpg
  const timestamp = Date.now();
  const objectName = `tasks/${taskId}/${caseId}/step_${stepIndex}_${timestamp}.jpg`;

  // 修正：传入 size 参数
  await client.putObject(bucket, objectName, compressedBuffer, compressedBuffer.length, {
    'Content-Type': 'image/jpeg',
  });

  const publicUrl = `${appConfig.minio.publicBaseUrl}/${bucket}/${objectName}`;
  console.log(`[MinIO] Uploaded: ${publicUrl}`);
  return publicUrl;
}

/**
 * 删除单张截图
 * @param objectName - 对象路径（不含桶名）
 */
export async function deleteScreenshot(objectName: string): Promise<void> {
  const client = initMinio();
  const bucket = appConfig.minio.bucket;
  await client.removeObject(bucket, objectName);
  console.log(`[MinIO] Deleted: ${objectName}`);
}

/**
 * 删除任务下的所有截图
 * @param taskId - 任务 ID
 */
export async function deleteTaskScreenshots(taskId: string): Promise<void> {
  const client = initMinio();
  const bucket = appConfig.minio.bucket;
  const prefix = `tasks/${taskId}/`;

  const objectsList: string[] = [];
  const stream = client.listObjects(bucket, prefix, true);

  await new Promise<void>((resolve, reject) => {
    stream.on('data', (obj: { name?: string }) => obj.name && objectsList.push(obj.name));
    stream.on('error', reject);
    stream.on('end', async () => {
      if (objectsList.length > 0) {
        await client.removeObjects(bucket, objectsList);
        console.log(`[MinIO] Deleted ${objectsList.length} screenshots for task ${taskId}`);
      }
      resolve();
    });
  });
}