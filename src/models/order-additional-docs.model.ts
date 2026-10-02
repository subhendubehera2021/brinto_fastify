import mongoose, { Schema, Document, Types } from 'mongoose';

const modelName = 'order_additional_docs';

export interface IOrderAdditionalDocs extends Document {
    order: Types.ObjectId;
    user: Types.ObjectId;
    document: Types.ObjectId;
    docType?: string;
    isActive: boolean;
    isDeleted: boolean;
}

const orderAdditionalDocsSchema = new Schema<IOrderAdditionalDocs>(
    {
        order: {
            type: Schema.Types.ObjectId,
            ref: 'b_orders',
            required: true,
        },
        user: {
            type: Schema.Types.ObjectId,
            ref: 'users',
            required: true,
        },
        document: {
            type: Schema.Types.ObjectId,
            ref: 'user-docs',
            required: true,
        },
        docType: { type: String, default: '' },
        isActive: { type: Boolean, default: true },
        isDeleted: { type: Boolean, default: false },
    },
    {
        timestamps: true,
    }
);

orderAdditionalDocsSchema.index(
    { order: 1, user: 1, document: 1 },
    { unique: true }
);

orderAdditionalDocsSchema.virtual('documentDetails', {
    ref: 'user-docs',
    localField: 'document',
    foreignField: '_id',
    justOne: true,
});

orderAdditionalDocsSchema.set('toObject', { virtuals: true });
orderAdditionalDocsSchema.set('toJSON', { virtuals: true });

const OrderAdditionalDocsModel =
    mongoose.models[modelName] ||
    mongoose.model<IOrderAdditionalDocs>(modelName, orderAdditionalDocsSchema);

export default OrderAdditionalDocsModel;
