import mongoose, { Schema, Document, Types } from 'mongoose';

const modelName = 'b_form_display_configs';

/**
 * Replaces six separate models:
 *   rto, scholarships, admissions, popular, form_general_mappings, form_local_mappings
 *
 * Type-specific fields go in the `meta` map so this schema never needs to change
 * when a new display surface is added.
 *
 * meta examples by displayType:
 *   rto:        { emoji, fee, tag, tagColor }
 *   scholarship:{ classLevel, state, gradientStart, gradientEnd }
 *   admission:  { category, state, gradientStart, gradientEnd }
 *   popular:    {}   (no extra meta needed)
 *   general:    {}   (replaces form_general_mappings)
 *   local:      { state, district, tahasil }
 */

export type DisplayType =
    | 'rto'
    | 'scholarship'
    | 'admission'
    | 'popular'
    | 'general'
    | 'local'
    | 'browse';

export interface IFormDisplayConfig extends Document {
    form: Types.ObjectId;
    displayType: DisplayType;
    title: string;
    subtitle: string;
    tags: string[];
    order: number;
    isActive: boolean;
    slug: string;
    meta: Map<string, any>;
}

const formDisplayConfigSchema = new Schema<IFormDisplayConfig>(
    {
        form: {
            type: Schema.Types.ObjectId,
            ref: 'b_forms',
            required: true,
        },
        displayType: {
            type: String,
            required: true,
            enum: ['rto', 'scholarship', 'admission', 'popular', 'general', 'local', 'browse'],
            index: true,
        },
        title: { type: String, trim: true, default: '' },
        subtitle: { type: String, trim: true, default: '' },
        tags: { type: [String], default: [] },
        order: { type: Number, default: 0, index: true },
        isActive: { type: Boolean, default: true },
        slug: { type: String, unique: true, sparse: true, default: null },

        // all type-specific fields live here
        meta: {
            type: Map,
            of: Schema.Types.Mixed,
            default: {},
        },
    },
    { timestamps: true }
);

formDisplayConfigSchema.index({ displayType: 1, isActive: 1, order: 1 });
// enables: find scholarship forms for a state
formDisplayConfigSchema.index({ displayType: 1, 'meta.state': 1 });
// enables: find local forms by district
formDisplayConfigSchema.index({ displayType: 1, 'meta.district': 1 });

const FormDisplayConfigModel =
    mongoose.models[modelName] ||
    mongoose.model<IFormDisplayConfig>(modelName, formDisplayConfigSchema);

export default FormDisplayConfigModel;
