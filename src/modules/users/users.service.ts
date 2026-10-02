import jwt from 'jsonwebtoken';
import usersDao, { type CreateUserData } from './users.dao';
import type { LoginPlatform } from '../../models/users.model';

type KVNamespace = {
  get(key: string, options?: { type?: 'json' | 'text' }): Promise<any>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
};

// MOCKED — in-memory, data lost on container sleep
const userKvStore = new Map<string, string>();
const inMemoryUserKV: KVNamespace = {
  get: async (key: string, options?: { type?: 'json' | 'text' }) => {
    const val = userKvStore.get(key) ?? null;
    if (val === null) return null;
    if (options?.type === 'json') {
      try {
        return JSON.parse(val);
      } catch {
        return null;
      }
    }
    return val;
  },
  put: async (key: string, value: string) => {
    userKvStore.set(key, value);
  },
  delete: async (key: string) => {
    userKvStore.delete(key);
  },
};

async function getKV(): Promise<KVNamespace | undefined> {
  return inMemoryUserKV;
}

const getTokenSecret = () => process.env.JWT_SECRET || 'your_secret_here';
const USER_CACHE_TTL = 86400; // 24 hours

export class UsersService {
  async getAllUsers(limit: number = 50) {
    return await usersDao.findUsers(limit);
  }

  async createUser(data: CreateUserData) {
    if (!data.user_name || !data.phone || !data.password || !data.user_id) {
      throw new Error('user_name, phone, password, and user_id are required');
    }

    const newUser = await usersDao.createUser({
      ...data,
      role: data.role && data.role.length > 0 ? data.role : ['USER'],
    });

    const userObj = (newUser as any).toObject ? (newUser as any).toObject() : { ...newUser };
    delete (userObj as any).password;
    return userObj;
  }

  async authenticateMobile(mobile: string, isInputMobile: boolean, loginPlatform: LoginPlatform) {
    if (!mobile) {
      throw new Error('mobile is required');
    }

    const kv = await getKV();
    const registeredCacheKey = `user:reg:${mobile}`;
    const profileCacheKey = `user:profile:${mobile}`;

    // 1. FAST PATH: Check "Mobile Registered" status from Cloudflare KV Cache
    if (isInputMobile && kv) {
      try {
        const isRegistered = await kv.get(registeredCacheKey, { type: 'text' });
        if (isRegistered === 'true') {
          return { isCacheHit: true, isInputMobile: true, data: { message: 'Mobile Registered' } };
        }
      } catch (cacheErr) {
        console.error('KV Cache read error:', cacheErr);
      }
    }

    // 2. FAST PATH: Check Cached User Profile from Cloudflare KV Cache
    if (!isInputMobile && kv) {
      try {
        const cachedUser = await kv.get(profileCacheKey, { type: 'json' });
        if (cachedUser && cachedUser._id) {
          const userAuthData = {
            id: String(cachedUser._id),
            user_id: cachedUser.user_id,
            user_name: cachedUser.user_name,
            role: cachedUser.role,
          };
          const token = jwt.sign(userAuthData, getTokenSecret(), { expiresIn: '7d' });
          return { isCacheHit: true, isInputMobile: false, data: { user: cachedUser, token } };
        }
      } catch (cacheErr) {
        console.error('KV Cache read error:', cacheErr);
      }
    }

    // 3. CACHE MISS: Query/Create User in MongoDB
    let user = await usersDao.findUserByPhone(mobile);

    if (!user) {
      const userName = Math.random().toString(36).slice(2, 10);
      const userId = `u_${Date.now().toString(36)}`;
      const randomPassword = Math.random().toString(36).slice(2, 12);

      user = await usersDao.createUser({
        phone: mobile,
        user_name: userName,
        user_id: userId,
        password: randomPassword,
        login_platform: loginPlatform,
        role: ['USER'],
        status: 1,
      });
    } else if (user.login_platform !== loginPlatform) {
      await usersDao.updateUser(String(user._id), { login_platform: loginPlatform });
      user.login_platform = loginPlatform;
    }

    const userObj = user.toObject ? user.toObject() : { ...user };
    delete (userObj as any).password;

    // 4. Asynchronously populate Cloudflare KV Cache (non-blocking)
    if (kv) {
      Promise.all([
        kv.put(registeredCacheKey, 'true', { expirationTtl: USER_CACHE_TTL }),
        kv.put(profileCacheKey, JSON.stringify(userObj), { expirationTtl: USER_CACHE_TTL }),
      ]).catch(() => {});
    }

    if (isInputMobile) {
      return { isCacheHit: false, isInputMobile: true, data: { message: 'Mobile Registered' } };
    }

    const userAuthData = {
      id: String(user._id),
      user_id: user.user_id,
      user_name: user.user_name,
      role: user.role,
      mobile: mobile
    };

    const token = jwt.sign(userAuthData, getTokenSecret(), { expiresIn: '7d' });

    return { isCacheHit: false, isInputMobile: false, data: { user: userObj, token } };
  }

  async loginWithUsername(userName: string, password: string) {
    if (!userName || !password) {
      throw new Error('user_name and password are required');
    }

    const user = await usersDao.findUserByUserName(userName);
    if (!user) {
      throw new Error('Invalid username or password');
    }

    const isMatch = typeof user.comparePassword === 'function'
      ? await user.comparePassword(password)
      : user.password === password;

    if (!isMatch) {
      throw new Error('Invalid username or password');
    }

    const userObj = user.toObject ? user.toObject({ virtuals: true }) : { ...user };
    userObj._id = String(userObj._id);
    userObj.id = String(userObj._id);
    userObj.name = userObj.name || '';
    userObj.email = userObj.email || '';
    userObj.password = '';

    const userAuthData = {
      id: String(user._id),
      user_id: user.user_id,
      user_name: user.user_name,
      role: user.role,
    };

    const token = jwt.sign(userAuthData, getTokenSecret(), { expiresIn: '7d' });

    return {
      user: userObj,
      token,
    };
  }
}

export default new UsersService();
