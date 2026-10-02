import mongoose, { Document, Schema, Types } from 'mongoose';

const modelName = 'user-docs';

export interface IUserDoc extends Document {
  user: Types.ObjectId;
  fileData?: any; // Binary data stored via Mongoose Buffer schema type
  fileType: string;
  fileExtension: string;
  fileName?: string;
  displayName?: string;
  fieldname?: string;
  uploadType?: string;
  fileSize?: number;
  file_url?: string;
  isDeleted?: boolean;
}

const userDocSchema: Schema<IUserDoc> = new Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
    fileData: { type: Schema.Types.Buffer },  // Use Schema.Types.Buffer (Cloudflare Workers safe)
    fileType: { type: String, required: true },
    fileExtension: { type: String, required: true },
    fileName: { type: String },
    displayName: {
      type: String,
      default: function (this: IUserDoc) {
        return this.fileName;
      },
    },
    fieldname: { type: String },
    uploadType: {
      type: String,
      enum: ['order', 'mydoc', 'order_result', 'form'],
      default: 'order',
    },
    fileSize: { type: Number },
    file_url: { type: String },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Custom validation: Ensure either fileData or file_url is present
userDocSchema.pre('validate', async function () {
  if (!this.fileData && !this.file_url) {
    throw new Error('Either fileData or file_url is required.');
  }
});

const UserDocModel =
  mongoose.models[modelName] ||
  mongoose.model<IUserDoc>(modelName, userDocSchema);

export default UserDocModel;
