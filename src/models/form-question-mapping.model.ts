import mongoose, { Schema, Document } from 'mongoose';

const modelName = 'b_form_questions';

export interface IFormQuestionOption {
    label: string;
    value: string;
}

export interface IFormQuestion {
    qsn_id: string;
    bind_key: string;
    type: string;
    order: number;
    isActive: boolean;
    options: IFormQuestionOption[];   // populated for chip/select types
}

export interface IFormQuestionMapping extends Document {
    form_id: string;
    questions: IFormQuestion[];
}

const formQuestionOptionSchema = new Schema<IFormQuestionOption>(
    {
        label: { type: String, required: true },   // display text  → "BSE, ODISHA"
        value: { type: String, required: true },   // stored value  → "BSE_ODISHA"
    },
    { _id: false }
);

const formQuestionSchema = new Schema<IFormQuestion>(
    {
        qsn_id: {
            type: String,
            required: true
        },
        bind_key: {
            type: String,
            required: true
        },
        type: {
            type: String,
            required: true
        },
        order: {
            type: Number,
            default: 0
        },
        isActive: {
            type: Boolean,
            default: true
        },
        options: {
            type: [formQuestionOptionSchema],
            default: []              // empty for text/phone/password types
        },
    },
    { _id: false }
);

const formQuestionMappingSchema = new Schema<IFormQuestionMapping>(
    {
        form_id: {
            type: String,
            required: true,
            unique: true
        },
        questions: {
            type: [formQuestionSchema],
            default: []
        },
    },
    { timestamps: true }
);

formQuestionMappingSchema.index({ form_id: 1 });
formQuestionMappingSchema.index({ form_id: 1, 'questions.qsn_id': 1 });
formQuestionMappingSchema.index({ form_id: 1, 'questions.bind_key': 1 });

const FormQuestionMappingModel =
    mongoose.models[modelName] ||
    mongoose.model<IFormQuestionMapping>(modelName, formQuestionMappingSchema);

export default FormQuestionMappingModel;