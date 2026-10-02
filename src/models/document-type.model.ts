import mongoose, { Schema, Document } from 'mongoose';

const modelName = 'b_document_types';

export interface IDocumentType extends Document {
    name: string;
    description: string;
    isActive: boolean;
}

const documentTypeSchema = new Schema<IDocumentType>(
    {
        name: { type: String, required: true, unique: true },
        description: { type: String, default: '' },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

const DocumentTypeModel =
    mongoose.models[modelName] ||
    mongoose.model<IDocumentType>(modelName, documentTypeSchema);

export default DocumentTypeModel;