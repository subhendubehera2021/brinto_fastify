import paymentsController from './payments.controller';
import { handleCorsPreflight } from '../../lib/cors';

export async function handlePaymentsRoute(request: Request, url: URL): Promise<Response | null> {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;

  const pathname = url.pathname;
  const method = request.method;

  // 1. POST /api/payments/create (Single endpoint — pass isSandbox: true/false in body)
  if ((pathname === '/api/payments/create' || pathname === '/api/payments/initiate') && method === 'POST') {
    return await paymentsController.createPayment(request);
  }

  // 2. POST or GET /api/payments/webhook
  if (pathname === '/api/payments/webhook' && (method === 'POST' || method === 'GET')) {
    const clonedReq = request.clone();
    const payload = await clonedReq.json().catch(async () => await clonedReq.text().catch(() => null));
    console.log('[Payments Webhook] Incoming request:', {
      method,
      pathname,
      queryParams: Object.fromEntries(url.searchParams.entries()),
      payload,
    });
    return await paymentsController.verifyWebhook(request, url);
  }

  // 3. POST or GET /api/payments/webhook/:transactionId
  const webhookMatch = pathname.match(/^\/api\/payments\/webhook\/([^\/]+)$/);
  if (webhookMatch && (method === 'POST' || method === 'GET')) {
    const clonedReq = request.clone();
    const payload = await clonedReq.json().catch(async () => await clonedReq.text().catch(() => null));
    console.log('[Payments Webhook] Incoming request with transactionId param:', {
      method,
      pathname,
      paramTransactionId: webhookMatch[1],
      queryParams: Object.fromEntries(url.searchParams.entries()),
      payload,
    });
    return await paymentsController.verifyWebhook(request, url, webhookMatch[1]);
  }

  return null;
}
