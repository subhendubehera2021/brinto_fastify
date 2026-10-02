import mongoose, { Document, Schema, Types } from 'mongoose';

const modelName = 'payments';

export interface IPayment extends Document {
  order?: Types.ObjectId;
  user: Types.ObjectId;
  amount: number;
  method?: 'card' | 'upi' | 'wallet' | 'cod';
  status: string;
  orderType: 'ORDER' | 'SUBSCRIPTION';
  transactionId?: string;
  orderId?: string;
  paymentDate: Date;
  paymentDetails: any;
}

const paymentSchema = new Schema<IPayment>({
  order: {
    type: Schema.Types.ObjectId,
    ref: 'b_orders',
    required: function (this: IPayment) {
      return this.orderType === 'ORDER';
    }
  },
  user: { type: Schema.Types.ObjectId, ref: 'users', required: true },
  amount: { type: Number, required: true },
  method: {
    type: String,
    enum: ['card', 'upi', 'wallet', 'cod']
  },
  status: {
    type: String,
    default: 'initiated'
  },
  orderType: {
    type: String,
    enum: ['ORDER', 'SUBSCRIPTION'],
    default: 'ORDER'
  },
  transactionId: { type: String },
  paymentDate: { type: Date, default: Date.now },
  orderId: {
    type: String,
    required: function (this: IPayment) {
      return this.orderType === 'ORDER';
    }
  },
  paymentDetails: {}
}, { timestamps: true });

export default mongoose.models[modelName] || mongoose.model<IPayment>(modelName, paymentSchema);
