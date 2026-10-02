import mongoose, { Schema, Document, Types } from 'mongoose';

const modelName = 'b_form_input_configs';

export interface IFormInputConfig extends Document {
    formId: string;
    inputDef: Types.ObjectId;
    required: boolean;
    order: number;
    isVisible: boolean;
    group: string | null;
    labelOverride: string | null;
    placeholderOverride: string | null;
    fileDescription: string | null;
    isNormal: boolean;
    ai: boolean;
}

const formInputConfigSchema = new Schema<IFormInputConfig>(
    {
        formId: { type: String, required: true },
        inputDef: {
            type: Schema.Types.ObjectId,
            ref: 'b_input_definitions',
            required: true,
        },
        required: { type: Boolean, default: true },
        order: { type: Number, default: 0 },
        isVisible: { type: Boolean, default: true },
        // logical grouping for the UI, e.g. "personal", "documents", "academic"
        group: { type: String, default: null },
        // overrides — only set when this form needs different text from the global definition
        labelOverride: { type: String, default: null },
        placeholderOverride: { type: String, default: null },
        fileDescription: { type: String, default: null },
        isNormal: { type: Boolean, default: true },
        ai: { type: Boolean, default: false },
    },
    { timestamps: true }
);

// fast lookup of all inputs for a form, sorted by display order
formInputConfigSchema.index({ formId: 1, order: 1 });
// prevent the same input appearing twice on the same form
formInputConfigSchema.index({ formId: 1, inputDef: 1 }, { unique: true });

const FormInputConfigModel =
    mongoose.models[modelName] ||
    mongoose.model<IFormInputConfig>(modelName, formInputConfigSchema);

export default FormInputConfigModel;
