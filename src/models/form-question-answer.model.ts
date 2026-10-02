import mongoose, { Schema, Document } from 'mongoose';

const modelName = 'b_form_question_answers';

export interface IFormQuestionAnswer extends Document {
    order_id: string;
    form_id: string;
    answers: Map<string, string>;
}

const formQuestionAnswerSchema = new Schema<IFormQuestionAnswer>(
    {
        order_id: {
            type: String,
            required: true,
        },
        form_id: {
            type: String,
            required: true,
        },
        answers: {
            type: Map,
            of: String,
            default: {},
        },
    },
    { timestamps: true }
);

// One answer doc per order+form combination
formQuestionAnswerSchema.index({ order_id: 1, form_id: 1 }, { unique: true });

const FormQuestionAnswerModel =
    mongoose.models[modelName] ||
    mongoose.model<IFormQuestionAnswer>(modelName, formQuestionAnswerSchema);

export default FormQuestionAnswerModel;