import mongoose, { Schema, Document, Types } from 'mongoose';

const modelName = 'b_feeds';

export interface IPostAttachment {
    fileType: string; // e.g., 'image', 'pdf', 'link'
    url: string;
    name?: string;
}

export interface IFeed extends Document {
    boardId: Types.ObjectId;
    title: string;
    body: string;
    tags: string[];
    deadline?: Date;
    vacancies?: number;
    applyUrl?: string;
    attachment?: IPostAttachment;
    savedBy: Types.ObjectId[];
    isClosed: boolean;
    postedAt: Date;
}

const attachmentSchema = new Schema<IPostAttachment>(
    {
        fileType: { type: String, required: true },
        url: { type: String, required: true },
        name: { type: String },
    },
    { _id: false }
);

const feedSchema = new Schema<IFeed>(
    {
        boardId: {
            type: Schema.Types.ObjectId,
            ref: 'b_recruitment_boards',
            required: true,
            index: true
        },
        title: { type: String, required: true },
        body: { type: String, required: true },
        tags: { type: [String], default: [] },
        deadline: { type: Date, default: null },
        vacancies: { type: Number, default: null },
        applyUrl: { type: String, default: null },
        attachment: { type: attachmentSchema, default: null },
        savedBy: [{ type: Schema.Types.ObjectId, ref: 'users' }],
        isClosed: { type: Boolean, default: false },
        postedAt: { type: Date, default: Date.now, index: true },
    },
    { timestamps: true }
);

// Virtual field to seamlessly fetch related board details
feedSchema.virtual('board', {
    ref: 'b_recruitment_boards',
    localField: 'boardId',
    foreignField: '_id',
    justOne: true,
});

feedSchema.set('toObject', { virtuals: true });
feedSchema.set('toJSON', { virtuals: true });

const FeedModel =
    mongoose.models[modelName] ||
    mongoose.model<IFeed>(modelName, feedSchema);

export default FeedModel;