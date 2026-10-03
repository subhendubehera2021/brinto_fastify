import { Types } from 'mongoose';
import documentsDao from './documents.dao';

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
}

export default new DocumentsService();
