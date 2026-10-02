import mongoose, { Schema, Document, Types } from 'mongoose';

const modelName = 'b_form_pricings';

export interface IFormPricing extends Document {
    form: Types.ObjectId;
    apply_charges: number;
    sale_apply_charges?: number;
    prebooking_apply_charges?: number;
    discount: number;
    pricingRules: any[];
}

const formPricingSchema = new Schema<IFormPricing>(
    {
        form: { type: Schema.Types.ObjectId, ref: 'b_forms', required: true, unique: true },
        apply_charges: { type: Number, required: true },
        sale_apply_charges: { type: Number, default: 0 },
        prebooking_apply_charges: { type: Number, default: 0 },
        discount: { type: Number, default: 0 },

        pricingRules: {
            type: [
                {
                    name: { type: String },
                    conditions: { type: Map, of: [String], default: {} },
                    price: { type: Number, default: null },
                    pricePerUnit: { type: Number, default: null },
                    unitField: { type: String, default: null },
                    priority: { type: Number, default: 0 },
                },
            ],
            default: [],
        },
    },
    { timestamps: true }
);

const FormPricingModel =
    mongoose.models[modelName] ||
    mongoose.model<IFormPricing>(modelName, formPricingSchema);

export default FormPricingModel;