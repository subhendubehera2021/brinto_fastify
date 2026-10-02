import mongoose, { Schema, Document, Types } from 'mongoose';

const modelName = 'b_form_submissions';

/**
 * Replaces: submited_forms
 *
 * Key changes:
 *  - Removed `submittedFormDetails: ObjectId[]` array.
 *    FieldValue documents are queried directly by orderId — no need to maintain this array too.
 *  - Removed duplicate `userId: string` field (use user ObjectId).
 *  - Added `pricingSnapshot` to record the exact pricing breakdown at submission time.
 */
export interface IFormSubmission extends Document {
    orderId: string;
    user: Types.ObjectId;
    form: Types.ObjectId;
    formId: string;
    pricingSnapshot: Record<string, any> | null;
    submittedAt: Date;
}

export const formSubmissionSchema = new Schema<IFormSubmission>(
    {
        orderId: { type: String, required: true, index: true },
        user: { type: Schema.Types.ObjectId, ref: 'users', required: true },
        form: { type: Schema.Types.ObjectId, ref: 'b_forms', required: true },
        formId: { type: String, required: true },

        // snapshot of the price engine result at the moment of submission
        // keeps order financials accurate even if pricingRules change later
        pricingSnapshot: { type: Schema.Types.Mixed, default: null },

        submittedAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

const FormSubmissionModel =
    mongoose.models[modelName] ||
    mongoose.model<IFormSubmission>(modelName, formSubmissionSchema);

export default FormSubmissionModel;
