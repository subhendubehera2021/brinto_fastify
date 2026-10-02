import mongoose, { Schema, Document, Types } from 'mongoose';

const modelName = 'orderresults';

export interface IOrderResult extends Document {
    user: Types.ObjectId;
    order: Types.ObjectId;
    orderId: string;
    file: Types.ObjectId;
}

const orderResultSchema = new Schema<IOrderResult>(
    {
        user: { type: Schema.Types.ObjectId, ref: 'users', required: true },
        order: { type: Schema.Types.ObjectId, ref: 'b_orders', required: true },
        orderId: { type: String, required: true },
        file: { type: Schema.Types.ObjectId, ref: 'user-docs', required: true },
    },
    { timestamps: true }
);

const OrderResultModel =
    mongoose.models[modelName] ||
    mongoose.model<IOrderResult>(modelName, orderResultSchema);

export default OrderResultModel;
