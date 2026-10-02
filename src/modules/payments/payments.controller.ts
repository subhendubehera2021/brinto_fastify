import paymentsService from './payments.service';
import { getAuthUser } from '../../lib/auth';

function jsonResponse(status: number, body: Record<string, any>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function unauthorizedResponse(): Response {
  return jsonResponse(401, { success: false, message: 'Unauthorized. Token missing or invalid.' });
}

export class PaymentsController {
  async createPayment(request: Request): Promise<Response> {
    const user = getAuthUser(request);
    if (!user) return unauthorizedResponse();

    const body = await request.json().catch(() => ({}));
    const isSandbox =
      body.isSandbox === true ||
      body.isSandbox === 'true' ||
      body.mode === 'sandbox' ||
      body.environment === 'sandbox';

    const payload = {
      ...body,
      isSandbox,
    };

    try {
      const result = await paymentsService.createPayment(user, payload);
      return jsonResponse(201, {
        success: true,
        message: 'Payment order initiated successfully',
        data: result,
      });
    } catch (error: any) {
      return jsonResponse(400, {
        success: false,
        message: error.message || 'Payment initiation failed',
      });
    }
  }

  async verifyWebhook(request: Request, url: URL, paramTransactionId?: string): Promise<Response> {
    const body = await request.json().catch(() => ({}));
    console.log('[Payments Controller] Webhook payload:', JSON.stringify(body, null, 2));

    const transactionId =
      paramTransactionId ||
      url.searchParams.get('transactionId') ||
      body.transactionId ||
      body.data?.order?.order_id;

    if (!transactionId) {
      return jsonResponse(400, { success: false, message: 'Transaction ID is required.' });
    }

    const isSandbox =
      url.searchParams.get('isSandbox') === 'true' ||
      body.isSandbox === true ||
      body.isSandbox === 'true' ||
      body.mode === 'sandbox' ||
      body.environment === 'sandbox';

    try {
      const result = await paymentsService.verifyWebhook(transactionId, isSandbox);
      return jsonResponse(200, {
        success: true,
        message: 'Payment verified successfully',
        data: result,
      });
    } catch (error: any) {
      return jsonResponse(400, {
        success: false,
        message: error.message || 'Payment verification failed',
      });
    }
  }
}

export default new PaymentsController();
