import mongoose, { Schema, Document, Types } from 'mongoose';

const modelName = 'b_orders';

/**
 * Replaces: orders + drafts
 *
 * Key changes:
 *  - Removed `submitedForms: ObjectId` (singular, confusing alongside the virtual).
 *    The link to FormSubmission is now only via the orderId virtual — one source of truth.
 *  - Added `form: ObjectId` direct ref for quick lookups without going through FormSubmission.
 *  - Removed `user_id: string` (duplicate of user ObjectId).
 *  - `status: 'DRAFT'` replaces the entire drafts model.
 *  - Kept printItems as-is since that feature is unrelated.
 */

export interface IPrintItem {
    document: Types.ObjectId;
    copies: number;
    colorMode: 'color' | 'bw';
    paperSize: 'A4' | 'A3' | 'Letter';
    sides: 'simplex' | 'duplex';
    pageRange?: string;
    price: number;
}

export const ORDER_STATUSES = [
    'PENDING',
    'PROCESSING',
    'READY_FOR_PICKUP',
    'COMPLETED',
    'CANCELLED',
    'DRAFT',
    'CART',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface IOrder extends Document {
    orderId: string;
    user: Types.ObjectId;
    form: Types.ObjectId;
    printItems?: IPrintItem[];
    pickupStore?: Types.ObjectId;
    storeId?: string;
    status: OrderStatus;
    orderType: 'NORMAL' | 'QUICK' | 'WHATSAPP' | 'PRINTING' | 'AI';
    contactNo: string;
    totalAmount: number;
    discount: number;
    promoCode: string;
    grandTotal: number;
    paymentStatus: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
    isActive: boolean;
    isDeleted: boolean;
}

const printItemSchema = new Schema<IPrintItem>({
    document: { type: Schema.Types.ObjectId, ref: 'user-docs', required: true },
    copies: { type: Number, required: true, default: 1, min: 1 },
    colorMode: { type: String, enum: ['color', 'bw'], required: true, default: 'bw' },
    paperSize: { type: String, enum: ['A4', 'A3', 'Letter'], required: true, default: 'A4' },
    sides: { type: String, enum: ['simplex', 'duplex'], required: true, default: 'simplex' },
    pageRange: { type: String, default: 'all' },
    price: { type: Number, required: true },
});

const orderSchema = new Schema<IOrder>(
    {
        orderId: { type: String, required: true, unique: true },
        user: { type: Schema.Types.ObjectId, ref: 'users', required: true },

        // direct form ref — replaces having to populate through formSubmission to know which form
        form: { type: Schema.Types.ObjectId, ref: 'b_forms', default: null },

        printItems: { type: [printItemSchema], default: [] },
        pickupStore: { type: Schema.Types.ObjectId, ref: 'PickupStore' },
        storeId: { type: String, default: null },

        status: {
            type: String,
            enum: ORDER_STATUSES,
            default: 'PENDING',
            required: true,
        },
        orderType: {
            type: String,
            enum: ['NORMAL', 'QUICK', 'WHATSAPP', 'PRINTING', 'AI'],
            default: 'NORMAL',
            required: true,
        },
        contactNo: { type: String, default: '' },
        totalAmount: { type: Number, required: true },
        discount: { type: Number, default: 0 },
        promoCode: { type: String, default: '' },
        grandTotal: { type: Number, required: true },
        paymentStatus: {
            type: String,
            enum: ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'],
            default: 'PENDING',
        },
        isActive: { type: Boolean, default: true },
        isDeleted: { type: Boolean, default: false },
    },
    { timestamps: true }
);

// validation
orderSchema.pre<IOrder>('save', async function () {
    if (this.orderType === 'QUICK' && !this.contactNo) {
        throw new Error('Contact number is required for QUICK orders.');
    }
});

// payments virtual — unchanged from original
orderSchema.virtual('payments', {
    ref: 'payments',
    localField: '_id',
    foreignField: 'order',
    justOne: false,
});

orderSchema.virtual('orderResults', {
    ref: 'orderresults',
    localField: 'orderId',
    foreignField: 'orderId',
    justOne: false,
});

// single source of truth for form submission link — via orderId, not a stored ObjectId
orderSchema.virtual('formSubmission', {
    ref: 'b_form_submissions',
    localField: 'orderId',
    foreignField: 'orderId',
    justOne: true,
});

// fetch all field values directly without going through FormSubmission
orderSchema.virtual('fieldValues', {
    ref: 'b_field_values',
    localField: 'orderId',
    foreignField: 'orderId',
    justOne: false,
});

orderSchema.virtual('additionalDocs', {
    ref: 'order_additional_docs',
    localField: '_id',
    foreignField: 'order',
    justOne: false,
});

orderSchema.set('toObject', { virtuals: true });
orderSchema.set('toJSON', { virtuals: true });

const OrderModel =
    mongoose.models[modelName] ||
    mongoose.model<IOrder>(modelName, orderSchema);

export default OrderModel;
