import UserModel, { type IUsers, type LoginPlatform } from '../../models/users.model';

export type CreateUserData = Partial<
  Pick<
    IUsers,
    'name' | 'phone' | 'email' | 'password' | 'dob' | 'role' | 'user_id' | 'user_name' | 'login_platform' | 'status'
  >
>;

export class UsersDao {
  async createUser(data: CreateUserData) {
    return await UserModel.create(data);
  }

  async findUsers(limit: number = 50) {
    return await UserModel.find({}, { password: 0 })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  async findUserById(id: string) {
    return await UserModel.findById(id, { password: 0 }).lean();
  }

  async findUserByPhone(phone: string) {
    return await UserModel.findOne({ phone }).exec();
  }

  async findUserByUserName(userName: string) {
    return await UserModel.findOne({
      $or: [{ user_name: userName }, { user_id: userName }],
    }).select('+password').exec();
  }

  async userNameExists(userName: string) {
    return Boolean(await UserModel.exists({ user_name: userName }));
  }

  async emailExists(email: string, excludeId?: string) {
    return Boolean(
      await UserModel.exists({
        email,
        ...(excludeId ? { _id: { $ne: excludeId } } : {}),
      })
    );
  }

  async updateUser(id: string, data: Partial<CreateUserData>) {
    return await UserModel.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    }).lean();
  }
}

export default new UsersDao();
