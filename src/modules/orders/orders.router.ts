import ordersController from './orders.controller';
import { handleCorsPreflight } from '../../lib/cors';

export async function handleOrdersRoute(request: Request, url: URL): Promise<Response | null> {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;

  const pathname = url.pathname;
  const method = request.method;

  // 1. POST /api/orders/create
  if (pathname === '/api/orders/create' && method === 'POST') {
    return await ordersController.createOrder(request);
  }

  // 2. POST /api/orders/create-with-details
  if (pathname === '/api/orders/create-with-details' && method === 'POST') {
    return await ordersController.createOrderWithDetails(request);
  }

  // 3. POST /api/orders/create-whatsapp
  if (pathname === '/api/orders/create-whatsapp' && method === 'POST') {
    return await ordersController.createWhatsappOrder(request);
  }

  // 4. POST /api/orders/create-ai
  if (pathname === '/api/orders/create-ai' && method === 'POST') {
    return await ordersController.createAiOrder(request);
  }

  // 5. POST /api/orders/create-printing
  if (pathname === '/api/orders/create-printing' && method === 'POST') {
    return await ordersController.createPrintingOrder(request);
  }

  // 6. GET /api/orders/my-orders
  if (pathname === '/api/orders/my-orders' && method === 'GET') {
    return await ordersController.getMyOrders(request, url);
  }

  // 7. GET /api/orders/my-printorders
  if (pathname === '/api/orders/my-printorders' && method === 'GET') {
    return await ordersController.getMyPrintOrders(request, url);
  }

  // 8. GET /api/orders/my-printorders/:orderId
  const myPrintDetailsMatch = pathname.match(/^\/api\/orders\/my-printorders\/([^\/]+)$/);
  if (myPrintDetailsMatch && method === 'GET') {
    return await ordersController.getMyPrintOrderDetails(request, myPrintDetailsMatch[1]);
  }

  // 9. GET /api/orders/non-printing
  if (pathname === '/api/orders/non-printing' && method === 'GET') {
    return await ordersController.getNonPrintingOrders(request, url);
  }

  // 10. GET /api/orders/non-printing/:orderId
  const nonPrintingDetailsMatch = pathname.match(/^\/api\/orders\/non-printing\/([^\/]+)$/);
  if (nonPrintingDetailsMatch && method === 'GET') {
    return await ordersController.getNonPrintingOrders(request, url, nonPrintingDetailsMatch[1]);
  }

  // 11. PATCH /api/orders/bulk-update
  if (pathname === '/api/orders/bulk-update' && method === 'PATCH') {
    return await ordersController.bulkUpdateOrders(request);
  }

  // 12. PATCH or PUT /api/orders/status
  if (pathname === '/api/orders/status' && (method === 'PATCH' || method === 'PUT')) {
    return await ordersController.updateOrderStatusFromRoot(request);
  }

  // 13. GET /api/orders
  if (pathname === '/api/orders' && method === 'GET') {
    return await ordersController.getAllOrders(request, url);
  }

  // 14. GET /api/orders/admin/non-printing
  if ((pathname === '/api/orders/admin/non-printing' || pathname === '/api/orders/admin/non-printing-orders') && method === 'GET') {
    return await ordersController.getAdminNonPrintingOrders(request, url);
  }

  // 15. GET /api/orders/admin/counts
  if ((pathname === '/api/orders/admin/counts' || pathname === '/api/orders/counts') && method === 'GET') {
    return await ordersController.getOrderCounts(request, url);
  }

  // 16. GET /api/orders/admin/details/:orderId or GET /api/orders/admin/:orderId
  const adminOrderDetailsMatch = pathname.match(/^\/api\/orders\/admin\/(?:details\/)?([^\/]+)$/);
  if (adminOrderDetailsMatch && method === 'GET' && adminOrderDetailsMatch[1] !== 'non-printing' && adminOrderDetailsMatch[1] !== 'counts') {
    return await ordersController.getAdminOrderDetails(request, adminOrderDetailsMatch[1]);
  }

  // Parameterized routes under /api/orders/:orderId/*
  const orderSubRouteMatch = pathname.match(/^\/api\/orders\/([^\/]+)(?:\/(apply-promo|remove-promo|checkout|field-values|status))?$/);
  if (orderSubRouteMatch) {
    const orderId = orderSubRouteMatch[1];
    const action = orderSubRouteMatch[2];

    if ((orderId === 'status' || orderId === 'bulk-update') && !action) {
      return null;
    }

    // PATCH or PUT /api/orders/:orderId/status
    if (action === 'status' && (method === 'PATCH' || method === 'PUT')) {
      return await ordersController.updateOrderStatus(request, orderId);
    }

    // POST /api/orders/:orderId/apply-promo
    if (action === 'apply-promo' && method === 'POST') {
      return await ordersController.applyPromoCode(request, orderId);
    }

    // POST /api/orders/:orderId/remove-promo
    if (action === 'remove-promo' && method === 'POST') {
      return await ordersController.removePromoCode(orderId);
    }

    // POST /api/orders/:orderId/checkout
    if (action === 'checkout' && method === 'POST') {
      return await ordersController.processCheckout(request, orderId);
    }

    // GET /api/orders/:orderId/field-values
    if (action === 'field-values' && method === 'GET') {
      return await ordersController.getOrderFieldValues(orderId);
    }

    // Direct /api/orders/:orderId
    if (!action) {
      if (method === 'GET') {
        return await ordersController.getOrderDetails(orderId);
      }
      if (method === 'PATCH') {
        return await ordersController.updateOrderDetails(request, orderId);
      }
    }
  }

  return null;
}
