import mongoose, { Schema, Document } from 'mongoose';

const modelName = 'b_recruitment_boards';

export interface IRecruitmentBoard extends Document {
    name: string;
    handle: string;
    bio: string;
    website: string;
    location: string;
    category: string;
    tags: string[];
    followerCount: number;
    postCount: number;
    isVerified: boolean;
    profilePic: string;
    backgroundPic: string;
    lastPostedAt: Date;
}

const recruitmentBoardSchema = new Schema<IRecruitmentBoard>(
    {
        name: { type: String, required: true },
        handle: { type: String, required: true, unique: true },
        bio: { type: String, default: '' },
        website: { type: String, default: '' },
        location: { type: String, default: '' },
        category: { type: String, default: '' },
        tags: { type: [String], default: [] },
        followerCount: { type: Number, default: 0 },
        postCount: { type: Number, default: 0 },
        isVerified: { type: Boolean, default: false },
        profilePic: { type: String, default: '' },
        backgroundPic: { type: String, default: '' },
        lastPostedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

const RecruitmentBoardModel =
    mongoose.models[modelName] ||
    mongoose.model<IRecruitmentBoard>(modelName, recruitmentBoardSchema);

export default RecruitmentBoardModel;