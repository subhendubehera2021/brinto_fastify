import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import storeOwnersDao from './store-owners.dao';

export class StoreOwnersError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const requireObjectId = (value: string, label: string) => {
  if (!Types.ObjectId.isValid(value)) throw new StoreOwnersError(`Invalid ${label}.`);
  return new Types.ObjectId(value);
};

const storeOwnersService = {
  async getMyStores(userId: string) {
    const stores = await storeOwnersDao.listStoresByUser(requireObjectId(userId, 'user ID'));
    return { count: stores.length, stores };
  },

  async getMyStoreById(storeId: string, userId: string) {
    requireObjectId(storeId, 'store ID');
    const store = await storeOwnersDao.getStoreByIdAndUser(storeId, requireObjectId(userId, 'user ID'));
    if (!store) throw new StoreOwnersError('Store not found or access denied.', 404);
    return store;
  },

  async getStoreByCustomId(storeId: string, userId: string, isAdmin: boolean) {
    if (!storeId) throw new StoreOwnersError('Store ID is required.');
    const store = await storeOwnersDao.getStoreByCustomIdAndUser(
      storeId,
      isAdmin ? undefined : requireObjectId(userId, 'user ID')
    );
    if (!store) throw new StoreOwnersError('Store not found or access denied.', 404);
    return store;
  },

  async createStore(user: { id: string; user_id: string }, input: Record<string, any>) {
    const required = ['storeName', 'displayName', 'contactNumber', 'ownerName'];
    if (required.some((key) => typeof input[key] !== 'string' || !input[key].trim())) {
      throw new StoreOwnersError('storeName, displayName, contactNumber, and ownerName are required.');
    }
    const userId = requireObjectId(user.id, 'user ID');
    const data: Record<string, unknown> = {
      user: userId,
      user_id: user.user_id,
      store_id: `STORE-${randomUUID()}`,
      storeName: input.storeName.trim(),
      displayName: input.displayName.trim(),
      contactNumber: input.contactNumber.trim(),
      ownerName: input.ownerName.trim(),
    };
    for (const key of ['whatsappNumber', 'logo', 'address'] as const) {
      if (typeof input[key] === 'string') data[key] = input[key].trim();
    }
    if (input.storeRef !== undefined && input.storeRef !== '') {
      data.storeRef = requireObjectId(String(input.storeRef), 'store reference');
    }
    const store = await storeOwnersDao.createStore(data);
    await storeOwnersDao.promoteUserToStoreOwner(userId);
    return store;
  },

  async updateStore(storeId: string, userId: string, input: Record<string, any>) {
    requireObjectId(storeId, 'store ID');
    const updates: Record<string, unknown> = {};
    for (const key of ['storeName', 'displayName', 'contactNumber', 'whatsappNumber', 'ownerName', 'status', 'address', 'logo']) {
      if (input[key] !== undefined) updates[key] = input[key];
    }
    if (updates.status !== undefined && !['ACTIVE', 'INACTIVE', 'PENDING'].includes(String(updates.status))) {
      throw new StoreOwnersError('status must be ACTIVE, INACTIVE, or PENDING.');
    }
    if (input.storeRef !== undefined) {
      updates.storeRef = input.storeRef ? requireObjectId(String(input.storeRef), 'store reference') : null;
    }
    if (!Object.keys(updates).length) throw new StoreOwnersError('At least one supported store field is required.');
    const store = await storeOwnersDao.updateStore(storeId, requireObjectId(userId, 'user ID'), updates);
    if (!store) throw new StoreOwnersError('Store not found or access denied.', 404);
    return store;
  },

  async deactivateStore(storeId: string, userId: string) {
    requireObjectId(storeId, 'store ID');
    const store = await storeOwnersDao.deactivateStore(storeId, requireObjectId(userId, 'user ID'));
    if (!store) throw new StoreOwnersError('Store not found or access denied.', 404);
    return store;
  },

  async adminGetAllStores(status: string | undefined, page: number, limit: number) {
    if (status && !['ACTIVE', 'INACTIVE', 'PENDING'].includes(status)) throw new StoreOwnersError('Invalid store status.');
    const result = await storeOwnersDao.listAllStores(status, (page - 1) * limit, limit);
    return { ...result, page, limit, totalPages: Math.ceil(result.total / limit) };
  },

  async adminGetStoreById(storeId: string) {
    requireObjectId(storeId, 'store ID');
    const store = await storeOwnersDao.getStoreById(storeId);
    if (!store) throw new StoreOwnersError('Store not found.', 404);
    return store;
  },

  async searchSubscribedStores(formId: string, search: string | undefined, page: number, limit: number) {
    if (!formId) throw new StoreOwnersError('formId is required.');
    const result = await storeOwnersDao.searchSubscribedStores(formId, search, (page - 1) * limit, limit);
    return { ...result, page, limit, totalPages: Math.ceil(result.total / limit) };
  },

  async addFormToStore(userId: string, isAdmin: boolean, storeId: string, formId: string) {
    if (!storeId || !formId) throw new StoreOwnersError('Store ID and Form ID are required.');
    const store = await storeOwnersDao.getStoreByCustomIdAndUser(
      storeId,
      isAdmin ? undefined : requireObjectId(userId, 'user ID')
    );
    if (!store) throw new StoreOwnersError('Store not found or access denied.', 404);
    const form = await storeOwnersDao.findForm(formId);
    if (!form) throw new StoreOwnersError('Form not found.', 404);
    if (await storeOwnersDao.findStoreForm(store._id, form._id)) {
      throw new StoreOwnersError('This form is already associated with the store.', 409);
    }
    return storeOwnersDao.createStoreForm({ store: store._id, storeId: store.store_id, form: form._id, formId: form.formId });
  },

  async getFormsForStore(storeId: string, page: number, limit: number, status?: string, search?: string) {
    if (!storeId) throw new StoreOwnersError('Store ID is required.');
    const result = await storeOwnersDao.listStoreForms(storeId, (page - 1) * limit, limit, status, search);
    return { ...result, page, limit, totalPages: Math.ceil(result.total / limit) };
  },

  async toggleFormStatus(id: string, isActive: unknown) {
    if (!Types.ObjectId.isValid(id)) throw new StoreOwnersError('Invalid store-form mapping ID.');
    if (typeof isActive !== 'boolean') throw new StoreOwnersError('isActive must be a boolean.');
    const mapping = await storeOwnersDao.updateStoreForm(id, isActive);
    if (!mapping) throw new StoreOwnersError('Store-form mapping not found.', 404);
    return mapping;
  },

  async removeFormFromStore(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new StoreOwnersError('Invalid store-form mapping ID.');
    const mapping = await storeOwnersDao.deleteStoreForm(id);
    if (!mapping) throw new StoreOwnersError('Store-form mapping not found.', 404);
    return mapping;
  },

  listPlans() {
    return storeOwnersDao.listPlans();
  },

  async subscribeStore(storeId: string, planId: string, userId: string) {
    if (!Types.ObjectId.isValid(storeId)) throw new StoreOwnersError('Invalid store ID.');
    const userObjectId = requireObjectId(userId, 'user ID');
    const store = await storeOwnersDao.getStoreByIdAndUser(storeId, userObjectId);
    if (!store) throw new StoreOwnersError('Store not found or access denied.', 404);
    const plan = await storeOwnersDao.getPlan(planId);
    if (!plan) throw new StoreOwnersError('Subscription plan not found.', 404);
    const existing = await storeOwnersDao.getStoreSubscription(store._id);
    if (existing?.paymentStatus === 'SUCCESS' && existing.expiresAt > new Date()) {
      throw new StoreOwnersError('You already have a valid plan and cannot subscribe again.', 409);
    }
    await storeOwnersDao.deactivateSubscriptions(store._id);
    const purchasedAt = new Date();
    const expiresAt = new Date(purchasedAt);
    expiresAt.setDate(expiresAt.getDate() + plan.validityDays);
    return storeOwnersDao.createSubscription({
      store: store._id,
      storeId: store.store_id,
      plan: plan._id,
      planId: plan.planId,
      status: 'PENDING',
      paymentStatus: 'PENDING',
      purchasedAt,
      expiresAt,
      ordersProcessed: 0,
      isActive: true,
    });
  },

  async getStoreSubscription(storeId: string, userId: string) {
    const store = await this.getMyStoreById(storeId, userId);
    return storeOwnersDao.getStoreSubscription(store._id);
  },
};

export default storeOwnersService;