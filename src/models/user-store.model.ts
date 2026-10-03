import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IUserStore extends Document {
  user: Types.ObjectId;
  user_id: string;
  store_id: string;
  storeName: string;
  displayName: string;
  contactNumber: string;
  whatsappNumber?: string;
  ownerName: string;
  address?: string;
  logo?: string;
  storeRef?: Types.ObjectId;
  rating?: number;
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING';
}

const userStoreSchema = new Schema<IUserStore>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'users', required: true },
    user_id: { type: String, required: true },
    store_id: { type: String, required: true, unique: true },
    storeName: { type: String, required: true },
    displayName: { type: String, required: true },
    contactNumber: { type: String, required: true },
    whatsappNumber: { type: String },
    ownerName: { type: String, required: true },
    address: { type: String },
    logo: { type: String },
    storeRef: { type: Schema.Types.ObjectId, ref: 'stores' },
    rating: { type: Number },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'PENDING'], default: 'PENDING' },
  },
  { timestamps: true, collection: 'b_user_stores' }
);

userStoreSchema.index({ user: 1 });
userStoreSchema.index({ user_id: 1 });
userStoreSchema.index({ store_id: 1 });

const UserStoreModel = mongoose.models.b_user_stores ||
  mongoose.model<IUserStore>('b_user_stores', userStoreSchema, 'b_user_stores');

export default UserStoreModel;