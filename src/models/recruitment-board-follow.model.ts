import mongoose, { Schema, Document, Types } from 'mongoose';

const modelName = 'b_recruitment_board_follows';

export interface IRecruitmentBoardFollow extends Document {
    userId: Types.ObjectId;
    boardId: Types.ObjectId;
    createdAt: Date;
}

const recruitmentBoardFollowSchema = new Schema<IRecruitmentBoardFollow>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'users', required: true, index: true },
        boardId: { type: Schema.Types.ObjectId, ref: 'b_recruitment_boards', required: true, index: true },
    },
    { timestamps: true }
);

// Ensure a user can only follow a specific board once
recruitmentBoardFollowSchema.index({ userId: 1, boardId: 1 }, { unique: true });

const RecruitmentBoardFollowModel =
    mongoose.models[modelName] ||
    mongoose.model<IRecruitmentBoardFollow>(modelName, recruitmentBoardFollowSchema);

export default RecruitmentBoardFollowModel;
