import mongoose, { Schema, Document } from 'mongoose';

const modelName = 'b_input_definitions';

export interface IInputDefinition extends Document {
    name: string;
    type: 'text' | 'option' | 'date' | 'file' | 'textarea' | 'number' | 'email' | 'checkbox' | 'radio' | 'range' | 'color' | 'tel' | 'url' | 'time' | 'datetime-local' | 'month' | 'week' | 'button' | 'reset' | 'submit' | 'image' | 'hidden' | 'password' | 'search' | 'chip';
    placeholder: string;
    options: any[];
    bindValue: string;
    acceptedTypes: string;
    sampleImage: string;
    isGlobal: boolean;
    isActive: boolean;
}

const inputDefinitionSchema = new Schema<IInputDefinition>(
    {
        name: { type: String, required: true, unique: true },
        type: {
            type: String,
            required: true,
            enum: [
                'text',
                'option',
                'date',
                'file',
                'textarea',
                'number',
                'email',
                'checkbox',
                'radio',
                'range',
                'color',
                'tel',
                'url',
                'time',
                'datetime-local',
                'month',
                'week',
                'button',
                'reset',
                'submit',
                'image',
                'hidden',
                'password',
                'search',
                'chip'
            ],
        },
        placeholder: { type: String, required: true },
        options: { type: [], default: [] },
        bindValue: {
            type: String,
            default: function (this: any) {
                return this.name
                    ? this.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '')
                    : '';
            },
        },
        acceptedTypes: {
            type: String,
            required: function (this: any) {
                return this.type === 'file';
            },
        },
        sampleImage: { type: String, default: null },
        isGlobal: { type: Boolean, default: true },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

inputDefinitionSchema.index({ isGlobal: 1, isActive: 1 });

const InputDefinitionModel =
    mongoose.models[modelName] ||
    mongoose.model<IInputDefinition>(modelName, inputDefinitionSchema);

export default InputDefinitionModel;
