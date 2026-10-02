import mongoose, { Schema, Document } from 'mongoose';
const modelName = 'users';

export type LoginPlatform = 'web' | 'ios' | 'android' | 'other';

export interface IUsers extends Document {
    name: string;
    phone: string;
    email: string;
    password: string;
    dob: Date;
    role: ('USER' | 'ADMIN' | 'STORE_OWNER')[];
    user_id: string;
    user_name: string;
    status: 1 | 2 | 3;
    login_platform?: LoginPlatform;
    comparePassword(candidatePassword: string): Promise<boolean>;
}

const usersSchema: Schema<IUsers> = new Schema({
    name: { type: String },
    user_name: { type: String, unique: true, required: true },
    phone: { type: String, required: true, unique: true },
    email: { type: String, default: '' },
    password: { type: String, required: true },
    dob: { type: Date },
    role: {
        type: [String],
        enum: ['USER', 'ADMIN', 'STORE_OWNER'],
        default: ['USER'], // ✅ Default role
        required: true,
    },
    user_id: { type: String, required: true, unique: true },
    login_platform: {
        type: String,
        enum: ['web', 'ios', 'android', 'other'],
        default: 'web',
    },
    status: {
        type: Number,
        enum: [1, 2, 3],
        default: 1, // Optional: set a default status
        required: true,
    },
}, {
    timestamps: true,
});

usersSchema.pre('save', async function () {
    if (this.isModified('password')) {
        const bcrypt = await import('bcryptjs');
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }
});

// ✅ Pre-update hook for findByIdAndUpdate and findOneAndUpdate
usersSchema.pre('findOneAndUpdate', async function () {
    const update = this.getUpdate() as any;

    if (update && update.password) {
        const bcrypt = await import('bcryptjs');
        const salt = await bcrypt.genSalt(10);
        update.password = await bcrypt.hash(update.password, salt);
        this.setUpdate(update);
    }
});

// Add method to compare password
usersSchema.methods.comparePassword = async function (
    candidatePassword: string
): Promise<boolean> {
    const bcrypt = await import('bcryptjs');
    return bcrypt.compare(candidatePassword, this.password);
};

usersSchema.set('toObject', { virtuals: true });
usersSchema.set('toJSON', { virtuals: true });

const usersModel =
    mongoose.models[modelName] || mongoose.model<IUsers>(modelName, usersSchema);

export default usersModel;
