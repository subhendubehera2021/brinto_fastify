import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { Types } from 'mongoose';
import documentsDao from './documents.dao';

export class R2ConfigurationError extends Error {}

export class DocumentUploadError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

const documentFields = {
  user: 1,
  fileType: 1,
  fileExtension: 1,
  fileName: 1,
  displayName: 1,
  fileSize: 1,
  file_url: 1,
  uploaded: 1,
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
    const uploadType = 'mydoc';
    const upload = await this.createUploadUrl(`users/${canonicalUserId}`, fileName, contentType);
    const normalizedFileName = fileName.trim().replace(/\\/g, '/');
    const storedFileName = path.posix.basename(normalizedFileName);
    const fileExtension = path.posix.extname(storedFileName).replace(/^\./, '').toLowerCase() || 'bin';
    const document = await documentsDao.createPendingUserDoc({
      user: new Types.ObjectId(canonicalUserId),
      fileType: contentType,
      fileExtension,
      fileName: storedFileName,
      displayName: storedFileName,
      uploadType,
      storageKey: upload.key,
      uploaded: false,
    });

    return { ...upload, documentId: document._id };
  }

  async updateUserDocumentUploaded(userId: string, documentId: string, uploaded: boolean) {
    const document = await documentsDao.getUserDocUploadDetails(documentId, userId);
    if (!document) throw new DocumentUploadError('Document not found.', 404);

    let fileUrl: string | undefined;
    let fileSize: number | undefined;
    if (uploaded) {
      if (!document.storageKey) {
        throw new DocumentUploadError('Document has no R2 upload key.', 409);
      }

      const accountId = process.env.CF_ACCOUNT_ID;
      const accessKeyId = process.env.R2_ACCESS_KEY_ID;
      const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
      const bucketName = process.env.R2_BUCKET_NAME;
      if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
        throw new R2ConfigurationError('R2 upload service is not configured.');
      }

      const r2 = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
      });
      try {
        const object = await r2.send(new HeadObjectCommand({ Bucket: bucketName, Key: document.storageKey }));
        if (typeof object.ContentLength === 'number') fileSize = object.ContentLength;
      } catch (error: any) {
        if (error?.$metadata?.httpStatusCode === 404 || error?.name === 'NotFound' || error?.name === 'NoSuchKey') {
          throw new DocumentUploadError('Uploaded file was not found in R2.', 409);
        }
        throw error;
      }
      fileUrl = `https://doc.brinto.in/${document.storageKey}`;
    }

    const updated = await documentsDao.setUserDocUploaded(documentId, userId, uploaded, fileUrl, fileSize);
    if (!updated) throw new DocumentUploadError('Document not found.', 404);
    return updated;
  }
}

export default new DocumentsService();
