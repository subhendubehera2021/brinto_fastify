import { Types } from 'mongoose';
import OrderModel from '../../models/order.model';
import UserDocModel from '../../models/user-doc.model';
import usersModel from '../../models/users.model';
import orderAdditionalDocsDao from './order-additional-docs.dao';

export class OrderAdditionalDocsService {
  /**
   * Resolves an order identifier (either Mongo _id or orderId string) to a Mongo ObjectId
   */
  private async resolveOrderId(orderInput: string): Promise<Types.ObjectId> {
    if (!orderInput) throw new Error('Order identifier is required.');

    const cleanInput = String(orderInput).trim();

    if (Types.ObjectId.isValid(cleanInput) && /^[a-fA-F0-9]{24}$/.test(cleanInput)) {
      const order = await OrderModel.findOne({ _id: cleanInput, isDeleted: { $ne: true } }).select('_id').lean();
      if (order) return order._id as Types.ObjectId;
    }

    const orderByOrderId = await OrderModel.findOne({ orderId: cleanInput, isDeleted: { $ne: true } }).select('_id').lean();
    if (orderByOrderId) return orderByOrderId._id as Types.ObjectId;

    throw new Error(`Order not found for identifier: ${orderInput}`);
  }

  /**
   * Resolves a user identifier (either Mongo _id or user_id string) to a Mongo ObjectId
   */
  private async resolveUserId(userInput: string): Promise<Types.ObjectId> {
    if (!userInput) throw new Error('User identifier is required.');

    const cleanInput = String(userInput).trim();

    if (Types.ObjectId.isValid(cleanInput) && /^[a-fA-F0-9]{24}$/.test(cleanInput)) {
      const user = await usersModel.findOne({ _id: cleanInput }).select('_id').lean();
      if (user) return user._id as Types.ObjectId;
    }

    const userByUserId = await usersModel.findOne({ user_id: cleanInput }).select('_id').lean();
    if (userByUserId) return userByUserId._id as Types.ObjectId;

    if (Types.ObjectId.isValid(cleanInput) && /^[a-fA-F0-9]{24}$/.test(cleanInput)) {
      return new Types.ObjectId(cleanInput);
    }

    throw new Error(`User not found for identifier: ${userInput}`);
  }

  /**
   * Inserts single or multiple additional doc records for an order
   */
  async createAdditionalDocs(authUserId: string, payload: any) {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Request body must be a JSON object or array.');
    }

    let items: any[] = [];
    if (Array.isArray(payload)) {
      items = payload;
    } else if (payload.documents && Array.isArray(payload.documents)) {
      items = payload.documents.map((docId: string) => ({
        order: payload.order || payload.orderId,
        user: payload.user || authUserId,
        document: docId,
        docType: payload.docType || '',
      }));
    } else {
      items = [payload];
    }

    if (items.length === 0) {
      throw new Error('No document items provided.');
    }

    const results = [];

    for (const item of items) {
      const rawOrder = item.order || item.orderId || payload.order || payload.orderId;
      const rawDocument = item.document || item.documentId;
      const rawUser = item.user || payload.user || authUserId;
      const docType = item.docType || payload.docType || '';

      if (!rawOrder) throw new Error('Order is required for each document record.');
      if (!rawDocument) throw new Error('Document ID is required for each document record.');

      const cleanDocId = String(rawDocument).trim();
      if (!Types.ObjectId.isValid(cleanDocId) || !/^[a-fA-F0-9]{24}$/.test(cleanDocId)) {
        throw new Error(`Invalid document ObjectId: ${rawDocument}`);
      }

      const orderObjId = await this.resolveOrderId(String(rawOrder));
      const userObjId = await this.resolveUserId(String(rawUser));
      const docObjId = new Types.ObjectId(cleanDocId);

      // Verify document exists
      const docExists = await UserDocModel.exists({ _id: docObjId, isDeleted: { $ne: true } });
      if (!docExists) {
        throw new Error(`User document not found: ${rawDocument}`);
      }

      const upserted = await orderAdditionalDocsDao.upsertDoc({
        order: orderObjId,
        user: userObjId,
        document: docObjId,
        docType,
      });

      results.push(upserted);
    }

    return results.length === 1 ? results[0] : results;
  }

  async getDocsForOrder(orderInput: string) {
    const orderObjId = await this.resolveOrderId(orderInput);
    return await orderAdditionalDocsDao.getByOrder(orderObjId);
  }

  async deleteAdditionalDoc(docId: string) {
    const cleanId = String(docId).trim();
    if (!Types.ObjectId.isValid(cleanId) || !/^[a-fA-F0-9]{24}$/.test(cleanId)) {
      throw new Error('Invalid record ID.');
    }
    const deleted = await orderAdditionalDocsDao.deleteById(cleanId);
    if (!deleted) throw new Error('Additional document record not found.');
    return deleted;
  }
}

export default new OrderAdditionalDocsService();
