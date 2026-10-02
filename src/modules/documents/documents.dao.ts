import { Types } from 'mongoose';
import UserDocModel, { type IUserDoc } from '../../models/user-doc.model';

export class DocumentsDao {
  async getAllUserDocs(
    conditions: Record<string, any> = {},
    selectedFields: Record<string, any> = {},
    page: number = 1,
    limit: number = 10
  ): Promise<{ docs: IUserDoc[]; total: number }> {
    const skip = (page - 1) * limit;
    const [docs, total] = await Promise.all([
      UserDocModel.find(conditions, selectedFields)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      UserDocModel.countDocuments(conditions),
    ]);

    return { docs, total };
  }
}

export default new DocumentsDao();
