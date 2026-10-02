import mongoose, { Schema, Document, Types } from 'mongoose';

const modelName = 'b_promo_codes';

export interface IPromoCode extends Document {
    code: string;
    discountType: 'PERCENTAGE' | 'FLAT';
    discountValue: number;
    maxDiscountAmount?: number;
    minOrderAmount?: number;
    isActive: boolean;
    validFrom?: Date;
    validUntil?: Date;
    usageLimit?: number;
    usedCount: number;
    allowedForms?: Types.ObjectId[];
}

const promoCodeSchema = new Schema<IPromoCode>(
    {
        // Force uppercase and trim spaces so '  SUMMER20 ' becomes 'SUMMER20'
        code: { type: String, required: true, unique: true, uppercase: true, trim: true },
        discountType: { type: String, enum: ['PERCENTAGE', 'FLAT'], required: true, default: 'FLAT' },
        discountValue: { type: Number, required: true },
        
        // Security & Constraints
        maxDiscountAmount: { type: Number, default: null }, // e.g., 50% off UP TO ₹100
        minOrderAmount: { type: Number, default: 0 },       // Must spend at least ₹500
        isActive: { type: Boolean, default: true },
        validFrom: { type: Date, default: null },
        validUntil: { type: Date, default: null },
        usageLimit: { type: Number, default: null },        // e.g., Only the first 100 users
        usedCount: { type: Number, default: 0 },
        
        // Optional: If empty, applies to all forms. If populated, only applies to specific forms.
        allowedForms: [{ type: Schema.Types.ObjectId, ref: 'b_forms' }]
    },
    { timestamps: true }
);

const PromoCodeModel =
    mongoose.models[modelName] ||
    mongoose.model<IPromoCode>(modelName, promoCodeSchema);

export default PromoCodeModel;