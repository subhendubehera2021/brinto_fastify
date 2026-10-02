import mongoose, { Schema, Document, Types } from 'mongoose';

const modelName = 'b_form_order_capabilities';

export interface IFormOrderCapabilities extends Document {
    form: Types.ObjectId;
    whatsapp: boolean;
    normal: boolean;
    quick: boolean;
    prebook: boolean;
    ai: boolean;
}

const formOrderCapabilitiesSchema = new Schema<IFormOrderCapabilities>(
    {
        form: { type: Schema.Types.ObjectId, ref: 'b_forms', required: true, unique: true },
        whatsapp: { type: Boolean, default: true },
        normal: { type: Boolean, default: true },
        quick: { type: Boolean, default: true },
        prebook: { type: Boolean, default: false },
        ai: { type: Boolean, default: false },
    },
    { timestamps: true }
);

const FormOrderCapabilitiesModel =
    mongoose.models[modelName] ||
    mongoose.model<IFormOrderCapabilities>(modelName, formOrderCapabilitiesSchema);

export default FormOrderCapabilitiesModel;