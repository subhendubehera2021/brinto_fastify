import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IStoreSubscription extends Document {
  store: Types.ObjectId;
  storeId: string;
  plan: Types.ObjectId;
  subscriptionId: string;
  planId: string;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'PENDING';
  purchasedAt: Date;
  expiresAt: Date;
  ordersProcessed: number;
  isActive: boolean;
  paymentStatus: 'PENDING' | 'SUCCESS' | 'FAILED';
}

const storeSubscriptionSchema = new Schema<IStoreSubscription>(
  {
    store: { type: Schema.Types.ObjectId, ref: 'b_user_stores', required: true },
    storeId: { type: String, required: true },
    plan: { type: Schema.Types.ObjectId, ref: 'b_subscription_plans', required: true },
    subscriptionId: { type: String, required: true, unique: true },
    planId: { type: String, required: true },
    status: { type: String, enum: ['ACTIVE', 'EXPIRED', 'CANCELLED', 'PENDING'], default: 'PENDING' },
    purchasedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    ordersProcessed: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    paymentStatus: { type: String, enum: ['PENDING', 'SUCCESS', 'FAILED'], default: 'PENDING' },
  },
  { timestamps: true, collection: 'b_store_subscriptions' }
);

storeSubscriptionSchema.pre('validate', function () {
  if (!this.subscriptionId) {
    this.subscriptionId = `SUB-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  }
});

storeSubscriptionSchema.index({ store: 1, status: 1 });
storeSubscriptionSchema.index({ storeId: 1, status: 1 });
storeSubscriptionSchema.index({ expiresAt: 1 });

const StoreSubscriptionModel = mongoose.models.b_store_subscriptions ||
  mongoose.model<IStoreSubscription>('b_store_subscriptions', storeSubscriptionSchema, 'b_store_subscriptions');

export default StoreSubscriptionModel;