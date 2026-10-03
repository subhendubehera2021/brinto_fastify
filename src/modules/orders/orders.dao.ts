import { Types } from 'mongoose';
import OrderModel, { type IOrder } from '../../models/order.model';
import UserModel from '../../models/users.model';
import FormsModel from '../../models/forms.model';
import FieldValueModel from '../../models/field-value.model';
import InputDefinitionModel from '../../models/input-definition.model';
import FormSubmissionModel from '../../models/form-submission.model';
import PaymentModel from '../../models/payment.model';
import UserDocModel from '../../models/user-doc.model';
import OrderResultModel from '../../models/order-result.model';
import OrderAdditionalDocsModel from '../../models/order-additional-docs.model';

export class OrdersDao {
  async createOrder(data: Partial<IOrder>, session?: any) {
    if (session) {
      const [order] = await OrderModel.create([data], { session });
      return order;
    }
    return await OrderModel.create(data);
  }

  async getByOrderId(orderId: string) {
    const filter = /^[a-fA-F0-9]{24}$/.test(orderId)
      ? { isDeleted: false, $or: [{ _id: orderId }, { orderId }] }
      : { isDeleted: false, orderId };

    return await OrderModel.findOne(filter)
      .populate({
        path: 'user',
        model: UserModel,
        select: 'name email phone',
      })
      .populate({
        path: 'form',
        model: FormsModel,
        select: 'name formId',
      })
      .populate({
        path: 'fieldValues',
        model: FieldValueModel,
        populate: {
          path: 'inputDef',
          model: InputDefinitionModel,
        },
      })
      .populate({
        path: 'formSubmission',
        model: FormSubmissionModel,
      })
      .populate({
        path: 'payments',
        model: PaymentModel,
        select: 'amount method status transactionId paymentDate paymentDetails -_id',
        options: { sort: { paymentDate: -1 } },
      })
      .populate({
        path: 'printItems.document',
        model: UserDocModel,
      })
      .populate({
        path: 'orderResults',
        model: OrderResultModel,
        populate: {
          path: 'file',
          model: UserDocModel,
        },
      })
      .populate({
        path: 'additionalDocs',
        model: OrderAdditionalDocsModel,
        match: { isDeleted: { $ne: true } },
        populate: {
          path: 'document',
          model: UserDocModel,
        },
      })
      .lean({ virtuals: true });
  }

  async updateOrder(orderId: string, data: Partial<IOrder>) {
    const filter = /^[a-fA-F0-9]{24}$/.test(orderId)
      ? { isDeleted: false, $or: [{ _id: orderId }, { orderId }] }
      : { isDeleted: false, orderId };

    return await OrderModel.findOneAndUpdate(
      filter,
      { $set: data },
      { returnDocument: 'after' }
    ).lean({ virtuals: true });
  }

  async updateOrderStatus(orderId: string, status: string) {
    return await this.updateOrder(orderId, { status } as Partial<IOrder>);
  }

  async bulkUpdateOrders(orderIds: string[], data: Partial<IOrder>) {
    return await OrderModel.updateMany(
      { orderId: { $in: orderIds } },
      { $set: data }
    );
  }

  async getAllOrders(filter: any = {}, skip: number = 0, limit: number = 10) {
    const query = { isDeleted: false, ...filter };
    const [orders, total] = await Promise.all([
      OrderModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean({ virtuals: true }),
      OrderModel.countDocuments(query),
    ]);
    return { orders, total };
  }

  async getOrdersByUser(userId: Types.ObjectId, filter: any = {}, skip: number = 0, limit: number = 10) {
    const query = { user: userId, isDeleted: false, ...filter };
    const [orders, total] = await Promise.all([
      OrderModel.find(query)
        .populate({
          path: 'form',
          model: FormsModel,
          select: 'name formId',
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean({ virtuals: true }),
      OrderModel.countDocuments(query),
    ]);
    return { orders, total };
  }

  async getPrintingOrdersByUser(userId: Types.ObjectId, skip: number = 0, limit: number = 10) {
    const query = {
      user: userId,
      orderType: 'PRINTING',
      isDeleted: false,
    };
    const [orders, total] = await Promise.all([
      OrderModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean({ virtuals: true }),
      OrderModel.countDocuments(query),
    ]);
    return { orders, total };
  }

  async getPrintingOrderDetailsByUser(orderId: string, userId: Types.ObjectId) {
    return await OrderModel.findOne({
      orderId,
      user: userId,
      orderType: 'PRINTING',
      isDeleted: false,
    }).lean({ virtuals: true });
  }

  async getNonPrintingOrders(userId?: string, orderId?: string, skip: number = 0, limit: number = 10) {
    const query: Record<string, any> = {
      orderType: { $ne: 'PRINTING' },
      isDeleted: false,
    };

    if (userId) {
      query.user = new Types.ObjectId(userId);
    }
    if (orderId) {
      query.orderId = orderId;
    }

    const baseQuery = OrderModel.find(query)
      .populate({
        path: 'user',
        model: UserModel,
        select: 'name email phone',
      })
      .populate({
        path: 'form',
        model: FormsModel,
        select: 'name formId',
      })
      .populate({
        path: 'fieldValues',
        model: FieldValueModel,
        populate: {
          path: 'inputDef',
          model: InputDefinitionModel,
        },
      })
      .populate({
        path: 'formSubmission',
        model: FormSubmissionModel,
      })
      .populate({
        path: 'payments',
        model: PaymentModel,
        select: 'amount method status transactionId paymentDate paymentDetails -_id',
        options: { sort: { paymentDate: -1 } },
      })
      .populate({
        path: 'printItems.document',
        model: UserDocModel,
      })
      .populate({
        path: 'orderResults',
        model: OrderResultModel,
        populate: {
          path: 'file',
          model: UserDocModel,
        },
      })
      .populate({
        path: 'additionalDocs',
        model: OrderAdditionalDocsModel,
        match: { isDeleted: { $ne: true } },
        populate: {
          path: 'document',
          model: UserDocModel,
        },
      })
      .sort({ createdAt: -1 });

    if (orderId) {
      const order = await baseQuery.findOne().lean({ virtuals: true });
      if (!order) {
        throw new Error('Non-printing order not found.');
      }
      return order;
    }

    const [orders, total] = await Promise.all([
      baseQuery.skip(skip).limit(limit).lean({ virtuals: true }),
      OrderModel.countDocuments(query),
    ]);

    return { orders, total };
  }

  async getAdminNonPrintingOrders(filter: any = {}, skip: number = 0, limit: number = 10) {
    const query: Record<string, any> = {
      orderType: { $ne: 'PRINTING' },
      isDeleted: false,
      ...filter,
    };

    const [orders, total] = await Promise.all([
      OrderModel.find(query)
        .populate({
          path: 'user',
          model: UserModel,
          select: 'name email phone',
        })
        .populate({
          path: 'form',
          model: FormsModel,
          select: 'name formId',
        })
        .populate({
          path: 'fieldValues',
          model: FieldValueModel,
          populate: {
            path: 'inputDef',
            model: InputDefinitionModel,
          },
        })
        .populate({
          path: 'formSubmission',
          model: FormSubmissionModel,
        })
        .populate({
          path: 'payments',
          model: PaymentModel,
          select: 'amount method status transactionId paymentDate paymentDetails -_id',
          options: { sort: { paymentDate: -1 } },
        })
        .populate({
          path: 'orderResults',
          model: OrderResultModel,
          populate: {
            path: 'file',
            model: UserDocModel,
          },
        })
        .populate({
          path: 'additionalDocs',
          model: OrderAdditionalDocsModel,
          populate: {
            path: 'document',
            model: UserDocModel,
          },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean({ virtuals: true }),
      OrderModel.countDocuments(query),
    ]);

    return { orders, total };
  }

  async getOrderCounts(filter: any = {}) {
    const query: Record<string, any> = {
      isDeleted: false,
      ...filter,
    };

    const defaultStatusCounts: Record<string, number> = {
      PENDING: 0,
      PROCESSING: 0,
      READY_FOR_PICKUP: 0,
      COMPLETED: 0,
      CANCELLED: 0,
      DRAFT: 0,
      CART: 0,
    };

    const defaultPaymentStatusCounts: Record<string, number> = {
      PENDING: 0,
      SUCCESS: 0,
      FAILED: 0,
      REFUNDED: 0,
    };

    const defaultOrderTypeCounts: Record<string, number> = {
      NORMAL: 0,
      QUICK: 0,
      WHATSAPP: 0,
      AI: 0,
      PRINTING: 0,
    };

    const [results] = await OrderModel.aggregate([
      { $match: query },
      {
        $facet: {
          statusCounts: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
          paymentStatusCounts: [{ $group: { _id: '$paymentStatus', count: { $sum: 1 } } }],
          orderTypeCounts: [{ $group: { _id: '$orderType', count: { $sum: 1 } } }],
          totalOrders: [{ $count: 'count' }],
        },
      },
    ]);

    const status = { ...defaultStatusCounts };
    if (results?.statusCounts) {
      results.statusCounts.forEach((item: any) => {
        if (item._id && Object.prototype.hasOwnProperty.call(status, item._id)) {
          status[item._id] = item.count;
        }
      });
    }

    const paymentStatus = { ...defaultPaymentStatusCounts };
    if (results?.paymentStatusCounts) {
      results.paymentStatusCounts.forEach((item: any) => {
        if (item._id && Object.prototype.hasOwnProperty.call(paymentStatus, item._id)) {
          paymentStatus[item._id] = item.count;
        }
      });
    }

    const orderType = { ...defaultOrderTypeCounts };
    if (results?.orderTypeCounts) {
      results.orderTypeCounts.forEach((item: any) => {
        if (item._id && Object.prototype.hasOwnProperty.call(orderType, item._id)) {
          orderType[item._id] = item.count;
        }
      });
    }

    const total = results?.totalOrders?.[0]?.count || 0;

    return {
      status,
      paymentStatus,
      orderType,
      total,
    };
  }

  async getAdminOrderDetails(orderId: string) {
    const filter = /^[a-fA-F0-9]{24}$/.test(orderId)
      ? { isDeleted: false, $or: [{ _id: orderId }, { orderId }] }
      : { isDeleted: false, orderId };

    return await OrderModel.findOne(filter)
      .populate({
        path: 'user',
        model: UserModel,
        select: 'name email phone user_id user_name role',
      })
      .populate({
        path: 'form',
        model: FormsModel,
        select: 'name formId slug display_img short_description state recruitmentboard',
      })
      .populate({
        path: 'fieldValues',
        model: FieldValueModel,
        populate: {
          path: 'inputDef',
          model: InputDefinitionModel,
        },
      })
      .populate({
        path: 'formSubmission',
        model: FormSubmissionModel,
      })
      .populate({
        path: 'payments',
        model: PaymentModel,
        options: { sort: { paymentDate: -1 } },
      })
      .populate({
        path: 'printItems.document',
        model: UserDocModel,
      })
      .populate({
        path: 'orderResults',
        model: OrderResultModel,
        populate: {
          path: 'file',
          model: UserDocModel,
        },
      })
      .populate({
        path: 'additionalDocs',
        model: OrderAdditionalDocsModel,
        match: { isDeleted: { $ne: true } },
        populate: {
          path: 'document',
          model: UserDocModel,
        },
      })
      .lean({ virtuals: true });
  }
}

export default new OrdersDao();
