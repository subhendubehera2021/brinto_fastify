import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IStoreForm extends Document {
  store: Types.ObjectId;
  storeId: string;
  form: Types.ObjectId;
  formId: string;
  isActive: boolean;
  status: string;
  addedAt: Date;
}

const storeFormSchema = new Schema<IStoreForm>(
  {
    store: { type: Schema.Types.ObjectId, ref: 'b_user_stores', required: true },
    storeId: { type: String, required: true },
    status: { type: String, default: 'approved' },
    form: { type: Schema.Types.ObjectId, ref: 'b_forms', required: true },
    formId: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    addedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'b_store_forms' }
);

storeFormSchema.index({ store: 1, form: 1 }, { unique: true });
storeFormSchema.index({ storeId: 1, formId: 1 }, { unique: true });
storeFormSchema.index({ store: 1 });
storeFormSchema.index({ form: 1 });
storeFormSchema.index({ status: 1 });

const StoreFormModel = mongoose.models.b_store_forms ||
  mongoose.model<IStoreForm>('b_store_forms', storeFormSchema, 'b_store_forms');

export default StoreFormModel;