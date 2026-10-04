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

  async getUserDocById(
    id: string,
    conditions: Record<string, any>,
    selectedFields: Record<string, any> = {}
  ): Promise<IUserDoc | null> {
    return await UserDocModel.findOne({ _id: id, ...conditions }, selectedFields).lean().exec() as IUserDoc | null;
  }

  async createPendingUserDoc(data: Record<string, unknown>) {
    return await UserDocModel.create(data);
  }

  async getUserDocUploadDetails(id: string, userId: string) {
    return await UserDocModel.findOne({ _id: id, user: userId, isDeleted: { $ne: true } })
      .select('storageKey uploaded')
      .lean()
      .exec();
  }

  async setUserDocUploaded(id: string, userId: string, uploaded: boolean) {
    return await UserDocModel.findOneAndUpdate(
      { _id: id, user: userId, isDeleted: { $ne: true } },
      { $set: { uploaded } },
      { new: true }
    ).select('_id uploaded').lean().exec();
  }
}

export default new DocumentsDao();
