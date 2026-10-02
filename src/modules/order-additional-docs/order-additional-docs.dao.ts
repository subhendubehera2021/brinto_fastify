import { Types } from 'mongoose';
import OrderAdditionalDocsModel, { type IOrderAdditionalDocs } from '../../models/order-additional-docs.model';
import UserDocModel from '../../models/user-doc.model';

export class OrderAdditionalDocsDao {
  async create(data: Partial<IOrderAdditionalDocs>) {
    return await OrderAdditionalDocsModel.create(data);
  }

  async upsertDoc(data: {
    order: Types.ObjectId;
    user: Types.ObjectId;
    document: Types.ObjectId;
    docType?: string;
  }) {
    return await OrderAdditionalDocsModel.findOneAndUpdate(
      {
        order: data.order,
        user: data.user,
        document: data.document,
      },
      {
        $set: {
          docType: data.docType || '',
          isActive: true,
          isDeleted: false,
        },
      },
      { upsert: true, new: true }
    ).lean();
  }

  async getByOrder(orderId: Types.ObjectId) {
    return await OrderAdditionalDocsModel.find({
      order: orderId,
      isDeleted: false,
    })
      .populate({
        path: 'document',
        model: UserDocModel,
      })
      .lean();
  }

  async deleteById(id: string) {
    return await OrderAdditionalDocsModel.findByIdAndUpdate(
      id,
      { $set: { isDeleted: true, isActive: false } },
      { new: true }
    ).lean();
  }
}

export default new OrderAdditionalDocsDao();
