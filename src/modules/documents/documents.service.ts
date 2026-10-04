import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { Types } from 'mongoose';
import documentsDao from './documents.dao';

export class R2ConfigurationError extends Error {}

const documentFields = {
  user: 1,
  fileType: 1,
  fileExtension: 1,
  fileName: 1,
  displayName: 1,
  fileSize: 1,
  file_url: 1,
  uploadType: 1,
  createdAt: 1,
};

const getVisibleDocumentConditions = (userId: string) => ({
  user: new Types.ObjectId(userId),
  uploadType: { $in: ['mydoc', 'order'] },
  isDeleted: { $ne: true },
});

export class DocumentsService {
  async getAllDocs(userId: string, page: number = 1, limit: number = 10) {
    return await documentsDao.getAllUserDocs(getVisibleDocumentConditions(userId), documentFields, page, limit);
  }

  async getDocById(userId: string, id: string) {
    return await documentsDao.getUserDocById(id, getVisibleDocumentConditions(userId), documentFields);
  }

  private async createUploadUrl(prefix: string, fileName: string, contentType: string) {
    const accountId = process.env.CF_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      throw new R2ConfigurationError('R2 upload service is not configured.');
    }

    const normalizedFileName = fileName.trim().replace(/\\/g, '/');
    const originalExtension = path.posix.extname(normalizedFileName);
    const extension = originalExtension.replace(/[^.a-zA-Z0-9]/g, '');
    const baseName = path.posix.basename(normalizedFileName, originalExtension)
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'upload';
    const key = `${prefix}/${baseName}-${randomUUID()}${extension}`;

    const r2 = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType,
    });
    const uploadURL = await getSignedUrl(r2, command, { expiresIn: 600 });

    return { uploadURL, key };
  }

  async getBlogUploadUrl(fileName: string, contentType = 'application/pdf') {
    return this.createUploadUrl('blogs', fileName, contentType);
  }

  async getUserUploadUrl(userId: string, fileName: string, contentType = 'application/pdf') {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid authenticated user ID.');
    }
    const canonicalUserId = new Types.ObjectId(userId).toHexString();
    return this.createUploadUrl(`users/${canonicalUserId}`, fileName, contentType);
  }
}

export default new DocumentsService();
