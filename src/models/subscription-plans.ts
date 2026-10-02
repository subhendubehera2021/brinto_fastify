import mongoose, { Schema, Document } from 'mongoose';

const modelName = 'b_subscription_plans';

export interface ISubscriptionPlan extends Document {
    planId: string;
    name: string;
    tagline: string;
    price: number;
    orderLimit: number;
    validityDays: number;
    badge?: string;
    icon?: string;
    buttonText?: string;
    isFeatured?: boolean;
    isActive: boolean;
}

const subscriptionPlanSchema = new Schema<ISubscriptionPlan>(
    {
        planId: { type: String, required: true, unique: true },
        name: { type: String, required: true },
        tagline: { type: String, required: true },
        price: { type: Number, required: true },
        orderLimit: { type: Number, required: true },
        validityDays: { type: Number, required: true },
        badge: { type: String, default: '' },
        icon: { type: String, default: '' },
        buttonText: { type: String, default: '' },
        isFeatured: { type: Boolean, default: false },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

const SubscriptionPlanModel =
    mongoose.models[modelName] ||
    mongoose.model<ISubscriptionPlan>(modelName, subscriptionPlanSchema);

export default SubscriptionPlanModel;