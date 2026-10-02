import mongoose, { Schema, Document, Types } from 'mongoose';

const modelName = 'b_field_values';

/**
 * Replaces: submitted_form_details
 *
 * Key changes:
 *  - inputDetails → inputDef, now refs b_input_definitions (not form_input_mappings)
 *  - Added denormalized `fieldName` and `bindValue` copied from InputDefinition at write time.
 *    This avoids a populate call every time you render order details.
 *  - orderId is the primary lookup key — no need to go through FormSubmission to find these.
 */
export interface IFieldValue extends Document {
    orderId: string;
    inputDef: Types.ObjectId;
    // denormalized at write time for fast reads — avoids populate on every order fetch
    fieldName: string;
    bindValue: string;
    value: any;
}

const fieldValueSchema = new Schema<IFieldValue>(
    {
        orderId: { type: String, required: true },
        inputDef: {
            type: Schema.Types.ObjectId,
            ref: 'b_input_definitions',
            required: true,
        },
        // copied from InputDefinition.name when the FieldValue is created
        fieldName: { type: String, default: '' },
        // copied from InputDefinition.bindValue when the FieldValue is created
        bindValue: { type: String, default: '' },
        value: { type: Schema.Types.Mixed, required: true },
    },
    { timestamps: true }
);

fieldValueSchema.index({ orderId: 1 });
// Ensure unique field values per order to prevent data duplication
fieldValueSchema.index({ orderId: 1, inputDef: 1 }, { unique: true });

const FieldValueModel =
    mongoose.models[modelName] ||
    mongoose.model<IFieldValue>(modelName, fieldValueSchema);

export default FieldValueModel;
