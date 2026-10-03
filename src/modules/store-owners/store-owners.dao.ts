import { Types } from 'mongoose';
import {
  FormsModel,
  StoreFormModel,
  StoreSubscriptionModel,
  SubscriptionPlanModel,
  UserModel,
  UserStoreModel,
} from '../../models';

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const storeOwnersDao = {
  listStoresByUser(userId: Types.ObjectId) {
    return UserStoreModel.find({ user: userId }).lean().exec();
  },

  getStoreByIdAndUser(storeId: string, userId: Types.ObjectId) {
    return UserStoreModel.findOne({ _id: storeId, user: userId }).lean().exec();
  },

  getStoreByCustomIdAndUser(storeId: string, userId?: Types.ObjectId) {
    return UserStoreModel.findOne({ store_id: storeId, ...(userId ? { user: userId } : {}) }).lean().exec();
  },

  createStore(data: Record<string, unknown>) {
    return UserStoreModel.create(data);
  },

  updateStore(storeId: string, userId: Types.ObjectId, data: Record<string, unknown>) {
    return UserStoreModel.findOneAndUpdate({ _id: storeId, user: userId }, { $set: data }, { new: true })
      .lean().exec();
  },

  deactivateStore(storeId: string, userId: Types.ObjectId) {
    return UserStoreModel.findOneAndUpdate(
      { _id: storeId, user: userId },
      { $set: { status: 'INACTIVE' } },
      { new: true }
    ).lean().exec();
  },

  async listAllStores(status: string | undefined, skip: number, limit: number) {
    const query = status ? { status } : {};
    const [stores, total] = await Promise.all([
      UserStoreModel.find(query).populate('user', 'name phone email user_id user_name')
        .skip(skip).limit(limit).lean().exec(),
      UserStoreModel.countDocuments(query),
    ]);
    return { stores, total };
  },

  getStoreById(storeId: string) {
    return UserStoreModel.findById(storeId).populate('user', 'name phone email user_id user_name')
      .lean().exec();
  },

  async searchSubscribedStores(formId: string, search: string | undefined, skip: number, limit: number) {
    const match: Record<string, any> = { status: 'ACTIVE' };
    if (search) {
      const safeSearch = escapeRegex(search);
      match.$or = [
        { storeName: { $regex: safeSearch, $options: 'i' } },
        { displayName: { $regex: safeSearch, $options: 'i' } },
      ];
    }

    const result = await UserStoreModel.aggregate([
      { $match: match },
      {
        $lookup: {
          from: 'b_store_forms',
          let: { storeId: '$_id' },
          pipeline: [{ $match: { $expr: { $eq: ['$store', '$$storeId'] }, formId, isActive: true } }, { $limit: 1 }],
          as: 'matchedForm',
        },
      },
      { $match: { matchedForm: { $ne: [] } } },
      {
        $lookup: {
          from: 'b_store_subscriptions',
          let: { storeId: '$_id' },
          pipeline: [{
            $match: {
              $expr: { $eq: ['$store', '$$storeId'] },
              status: 'ACTIVE',
              isActive: true,
              expiresAt: { $gt: new Date() },
            },
          }, { $limit: 1 }],
          as: 'activeSubscription',
        },
      },
      { $match: { activeSubscription: { $ne: [] } } },
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [{ $skip: skip }, { $limit: limit }, { $project: { matchedForm: 0, activeSubscription: 0 } }],
        },
      },
    ]).exec();

    return { stores: result[0]?.data || [], total: result[0]?.metadata[0]?.total || 0 };
  },

  findForm(formId: string) {
    return FormsModel.findOne(Types.ObjectId.isValid(formId)
      ? { $or: [{ _id: formId }, { formId }] }
      : { formId }).exec();
  },

  findStoreForm(store: Types.ObjectId, form: Types.ObjectId) {
    return StoreFormModel.findOne({ store, form }).exec();
  },

  createStoreForm(data: Record<string, unknown>) {
    return StoreFormModel.create(data);
  },

  async listStoreForms(storeId: string, skip: number, limit: number, status?: string, search?: string) {
    const match: Record<string, any> = { storeId };
    if (status) match.status = status;
    const pipeline: Record<string, any>[] = [
      { $match: match },
      { $lookup: { from: 'b_forms', localField: 'form', foreignField: '_id', as: 'form' } },
      { $unwind: '$form' },
    ];
    if (search) {
      const safeSearch = escapeRegex(search);
      pipeline.push({ $match: { $or: [
        { formId: { $regex: safeSearch, $options: 'i' } },
        { 'form.name': { $regex: safeSearch, $options: 'i' } },
      ] } });
    }
    pipeline.push({ $facet: { metadata: [{ $count: 'total' }], data: [{ $skip: skip }, { $limit: limit }] } });
    const result = await StoreFormModel.aggregate(pipeline as any[]).exec();
    return { forms: result[0]?.data || [], total: result[0]?.metadata[0]?.total || 0 };
  },

  updateStoreForm(id: string, isActive: boolean) {
    return StoreFormModel.findByIdAndUpdate(id, { isActive }, { new: true }).exec();
  },

  deleteStoreForm(id: string) {
    return StoreFormModel.findByIdAndDelete(id).exec();
  },

  listPlans() {
    return SubscriptionPlanModel.find({ isActive: true }).exec();
  },

  getPlan(planId: string) {
    return SubscriptionPlanModel.findOne({ planId, isActive: true }).exec();
  },

  getStoreSubscription(storeId: Types.ObjectId) {
    return StoreSubscriptionModel.findOne({ store: storeId, isActive: true }).populate('plan').exec();
  },

  deactivateSubscriptions(storeId: Types.ObjectId) {
    return StoreSubscriptionModel.updateMany(
      { store: storeId, isActive: true },
      { $set: { status: 'EXPIRED', isActive: false } }
    ).exec();
  },

  createSubscription(data: Record<string, unknown>) {
    return StoreSubscriptionModel.create(data);
  },

  promoteUserToStoreOwner(userId: Types.ObjectId) {
    return UserModel.findByIdAndUpdate(userId, { $addToSet: { role: 'STORE_OWNER' } }).exec();
  },
};

export default storeOwnersDao;