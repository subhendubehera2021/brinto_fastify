export interface CashfreeUser {
  user_id?: string;
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  mobile?: string;
}

export interface CreateOrderOptions {
  amount: number | string;
  order_id?: string;
  return_url?: string;
  order_note?: string;
}

/**
 * Utility to safely fetch environment variables in Node.js runtime.
 */
async function getEnvVar(key: string): Promise<string> {
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key] as string;
  }

  return '';
}

const CASHFREE_BASE_URL_PROD = 'https://api.cashfree.com/pg';
const CASHFREE_BASE_URL_SANDBOX = 'https://sandbox.cashfree.com/pg';
const CASHFREE_API_VERSION = '2023-08-01';

class CashFreeService {
  /**
   * Helper to retrieve and validate Cashfree credentials from environment.
   */
  private async getCredentials(isSandbox: boolean = false) {
    const appIdKey = isSandbox ? 'CASHFREE_TEST_APP_ID' : 'CASHFREE_PROD_APP_ID';
    const secretKeyKey = isSandbox ? 'CASHFREE_TEST_SECRET_KEY' : 'CASHFREE_PROD_SECRET_KEY';

    const appId = await getEnvVar(appIdKey);
    const secretKey = await getEnvVar(secretKeyKey);

    // Validate that required secrets/env variables are present
    if (!appId || !secretKey) {
      const mode = isSandbox ? 'Sandbox/Test' : 'Production';
      const missingKeys: string[] = [];
      if (!appId) missingKeys.push(appIdKey);
      if (!secretKey) missingKeys.push(secretKeyKey);

      throw new Error(
        `[Cashfree Config Error] Missing Cashfree ${mode} credentials: ${missingKeys.join(', ')}. Please configure these in Cloudflare Secrets or .env file.`
      );
    }

    return { appId, secretKey };
  }

  /**
   * Core order creation logic using native edge fetch.
   */
  async createOrder(user: CashfreeUser, data: CreateOrderOptions, isSandbox: boolean = false) {
    if (!data || data.amount === undefined || data.amount === null || Number(data.amount) <= 0) {
      throw new Error('[Cashfree Validation Error] Valid order amount (> 0) is required.');
    }

    const { appId, secretKey } = await this.getCredentials(isSandbox);
    const baseUrl = isSandbox ? CASHFREE_BASE_URL_SANDBOX : CASHFREE_BASE_URL_PROD;

    const requestPayload: any = {
      order_amount: Number(data.amount),
      order_currency: 'INR',
      customer_details: {
        customer_id: user?.user_id || user?.id || 'GUEST',
        customer_name: user?.name || 'Customer',
        customer_email: user?.email || user?.user_id +"@gmail.com" || '',
        customer_phone: user?.mobile || '9090407368',
      },
      order_meta: {
        return_url: data?.return_url || 'https://www.brinto.in',
      },
      order_note: data?.order_note || '',
    };

    if (data.order_id) {
      requestPayload.order_id = data.order_id;
    }

    try {
      const response = await fetch(`${baseUrl}/orders`, {
        method: 'POST',
        headers: {
          'x-client-id': appId,
          'x-client-secret': secretKey,
          'x-api-version': CASHFREE_API_VERSION,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      });

      const resData = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errorMsg =
          resData?.message || resData?.data?.message || `Cashfree API HTTP ${response.status}`;
        throw new Error(`[Cashfree API Error] ${errorMsg}`);
      }

      return resData;
    } catch (error: any) {
      console.error(
        `[Cashfree] Error creating ${isSandbox ? 'Sandbox' : 'Production'} order:`,
        error?.message || error
      );
      throw error;
    }
  }

  /**
   * Core order verification logic using native edge fetch.
   */
  async verifyOrder(orderId: string, isSandbox: boolean = false) {
    if (!orderId || !orderId.trim()) {
      throw new Error('[Cashfree Validation Error] Order ID is required for verification.');
    }

    const { appId, secretKey } = await this.getCredentials(isSandbox);
    const baseUrl = isSandbox ? CASHFREE_BASE_URL_SANDBOX : CASHFREE_BASE_URL_PROD;

    try {
      const response = await fetch(`${baseUrl}/orders/${encodeURIComponent(orderId)}`, {
        method: 'GET',
        headers: {
          'x-client-id': appId,
          'x-client-secret': secretKey,
          'x-api-version': CASHFREE_API_VERSION,
          'Accept': 'application/json',
        },
      });

      const resData = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errorMsg =
          resData?.message || resData?.data?.message || `Cashfree API HTTP ${response.status}`;
        throw new Error(`[Cashfree API Error] ${errorMsg}`);
      }

      return resData;
    } catch (error: any) {
      console.error(
        `[Cashfree] Error verifying ${isSandbox ? 'Sandbox' : 'Production'} order ${orderId}:`,
        error?.message || error
      );
      throw error;
    }
  }

  // ==================== ALIAS / CONVENIENCE METHODS ====================

  async createPayment(user: CashfreeUser, data: CreateOrderOptions) {
    return this.createOrder(user, data, false);
  }

  async createcashfreeSandPayment(user: CashfreeUser, data: CreateOrderOptions) {
    return this.createOrder(user, data, true);
  }

  async verifyPayment(orderId: string) {
    return this.verifyOrder(orderId, false);
  }

  async verifySandPayment(orderId: string) {
    return this.verifyOrder(orderId, true);
  }
}

export default new CashFreeService();
