import mongoose, { Schema, Document, Types } from 'mongoose';

const modelName = 'b_forms';

const generateSlug = (title: string, id: any): string => {
    const base = title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 60);
    return `${base}-${id}`;
};

export interface IForms extends Document {
    name: string;
    slug: string;
    formId: string;
    last_date: Date;
    short_description: string;
    state: string;
    recruitmentboard: string;
    inputConfigs: Types.ObjectId[];
    status: string;
    thumbnail: Types.ObjectId;
    total_vacancy: number;
    processingTime: string;
    type: string;
    isActive: boolean;
    requireDocuments: Types.ObjectId[];
    display_img: string;
    key: string;
    pricing?: any;
    orderCapabilities?: any;
}

const formsSchema = new Schema<IForms>(
    {
        name: { type: String, required: true, unique: true },
        slug: { type: String, unique: true },
        formId: { type: String, required: true, unique: true },
        last_date: { type: Date, required: true },
        status: { type: String, required: true, default: 'pending' },
        short_description: { type: String, required: true },
        state: { type: String, required: true },
        recruitmentboard: { type: String, required: true },
        inputConfigs: [
            { type: Schema.Types.ObjectId, ref: 'b_form_input_configs' },
        ],
        thumbnail: { type: Schema.Types.ObjectId, ref: 'user-docs' },
        total_vacancy: { type: Number, required: true },
        processingTime: { type: String },
        type: { type: String, default: 'job_application_form' },
        isActive: { type: Boolean, default: true },
        requireDocuments: [
            { type: Schema.Types.ObjectId, ref: 'b_document_types' }
        ],
        display_img: { type: String, default: '' },
        key: { type: String },
    },
    { timestamps: true }
);

formsSchema.pre('save', async function () {
    if (!this.slug) {
        this.slug = generateSlug(this.name, this._id);
    }
});

// Virtual field to seamlessly fetch related pricing configuration
formsSchema.virtual('pricing', {
    ref: 'b_form_pricings',
    localField: '_id',
    foreignField: 'form',
    justOne: true,
});

// Virtual field to seamlessly fetch related order capabilities
formsSchema.virtual('orderCapabilities', {
    ref: 'b_form_order_capabilities',
    localField: '_id',
    foreignField: 'form',
    justOne: true,
});

formsSchema.set('toObject', { virtuals: true });
formsSchema.set('toJSON', { virtuals: true });

const FormsModel =
    mongoose.models[modelName] ||
    mongoose.model<IForms>(modelName, formsSchema);

export default FormsModel;
