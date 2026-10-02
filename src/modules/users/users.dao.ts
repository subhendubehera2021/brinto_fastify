import UserModel, { type IUsers, type LoginPlatform } from '../../models/users.model';
import { withMongoCollection } from '../../lib/db';

export type CreateUserData = Partial<
  Pick<
    IUsers,
    'name' | 'phone' | 'email' | 'password' | 'dob' | 'role' | 'user_id' | 'user_name' | 'login_platform' | 'status'
  >
>;

export class UsersDao {
  async createUser(data: CreateUserData) {
    return await withMongoCollection('users', async (col) => {
      const now = new Date();
      const doc = {
        ...data,
        createdAt: now,
        updatedAt: now,
        status: data.status ?? 1,
        role: data.role && data.role.length > 0 ? data.role : ['USER'],
      };
      const result = await col.insertOne(doc);
      return { _id: result.insertedId, ...doc };
    });
  }

  async findUsers(limit: number = 50) {
    return await withMongoCollection('users', async (col) => {
      return await col
        .find({}, { projection: { password: 0 } })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();
    });
  }

  async findUserById(id: string) {
    return await withMongoCollection('users', async (col) => {
      const { ObjectId } = await import('mongodb');
      let query: any = { _id: id };
      try {
        query = { _id: new ObjectId(id) };
      } catch {
        // Fall back to string id
      }
      return await col.findOne(query, { projection: { password: 0 } });
    });
  }

  async findUserByPhone(phone: string) {
    return await withMongoCollection('users', async (col) => {
      return await col.findOne({ phone });
    });
  }

  async findUserByUserName(userName: string) {
    return await withMongoCollection('users', async (col) => {
      return await col.findOne({
        $or: [{ user_name: userName }, { user_id: userName }],
      });
    });
  }

  async userNameExists(userName: string) {
    return await withMongoCollection('users', async (col) => {
      const doc = await col.findOne({ user_name: userName }, { projection: { _id: 1 } });
      return Boolean(doc);
    });
  }

  async emailExists(email: string, excludeId?: string) {
    return await withMongoCollection('users', async (col) => {
      const query: any = { email };
      if (excludeId) {
        try {
          const { ObjectId } = await import('mongodb');
          query._id = { $ne: new ObjectId(excludeId) };
        } catch {
          query._id = { $ne: excludeId };
        }
      }
      const doc = await col.findOne(query, { projection: { _id: 1 } });
      return Boolean(doc);
    });
  }

  async updateUser(id: string, data: Partial<CreateUserData>) {
    return await withMongoCollection('users', async (col) => {
      const { ObjectId } = await import('mongodb');
      let query: any = { _id: id };
      try {
        query = { _id: new ObjectId(id) };
      } catch {
        // Fall back to string id
      }
      const updateData = { ...data, updatedAt: new Date() };
      await col.updateOne(query, { $set: updateData });
      return await col.findOne(query, { projection: { password: 0 } });
    });
  }
}

export default new UsersDao();
