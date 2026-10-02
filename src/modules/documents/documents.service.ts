import { Types } from 'mongoose';
import documentsDao from './documents.dao';

export class DocumentsService {
  async getAllDocs(userId: string, page: number = 1, limit: number = 10) {
    const selectedFields = {
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

    const conditions = {
      user: new Types.ObjectId(userId),
      uploadType: { $in: ['mydoc', 'order'] },
      isDeleted: { $ne: true },
    };

    return await documentsDao.getAllUserDocs(conditions, selectedFields, page, limit);
  }
}

export default new DocumentsService();
