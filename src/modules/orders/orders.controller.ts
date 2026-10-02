import ordersService from './orders.service';
import { getAuthUser, hasRole } from '../../lib/auth';

function jsonResponse(status: number, body: Record<string, any>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function unauthorizedResponse(): Response {
  return jsonResponse(401, { success: false, message: 'Unauthorized. Token missing or invalid.' });
}

function forbiddenResponse(msg: string): Response {
  return jsonResponse(403, { success: false, message: `Forbidden. ${msg}` });
}

export class OrdersController {
  async createOrder(request: Request): Promise<Response> {
    const user = getAuthUser(request);
    if (!user) return unauthorizedResponse();
    const payload = await request.json().catch(() => ({}));
    try {
      const result = await ordersService.createNewOrder(user.id, payload);
      return jsonResponse(201, { success: true, message: 'Order created successfully', data: result });
    } catch (error: any) {
      return jsonResponse(400, { success: false, message: error.message || 'Failed to create order' });
    }
  }

  async createOrderWithDetails(request: Request): Promise<Response> {
    const user = getAuthUser(request);
    if (!user) return unauthorizedResponse();
    const payload = await request.json().catch(() => ({}));
    try {
      const result = await ordersService.createOrderWithDetails(user.id, payload);
      return jsonResponse(201, { success: true, message: 'Order and submission details created successfully', data: result });
    } catch (error: any) {
      return jsonResponse(400, { success: false, message: error.message || 'Failed to create order with details' });
    }
  }

  async createWhatsappOrder(request: Request): Promise<Response> {
    const user = getAuthUser(request);
    if (!user) return unauthorizedResponse();
    const payload = await request.json().catch(() => ({}));
    try {
      const result = await ordersService.createWhatsappOrder(user.id, payload);
      return jsonResponse(201, { success: true, message: 'WhatsApp order created successfully', data: result });
    } catch (error: any) {
      return jsonResponse(400, { success: false, message: error.message || 'Failed to create WhatsApp order' });
    }
  }

  async createAiOrder(request: Request): Promise<Response> {
    const user = getAuthUser(request);
    if (!user) return unauthorizedResponse();
    const payload = await request.json().catch(() => ({}));
    try {
      const result = await ordersService.createAiOrder(user.id, payload);
      return jsonResponse(201, { success: true, message: 'AI order created successfully', data: result });
    } catch (error: any) {
      return jsonResponse(400, { success: false, message: error.message || 'Failed to create AI order' });
    }
  }

  async createPrintingOrder(request: Request): Promise<Response> {
    const user = getAuthUser(request);
    if (!user) return unauthorizedResponse();
    const payload = await request.json().catch(() => ({}));
    try {
      const result = await ordersService.createPrintingOrder(user.id, payload);
      return jsonResponse(201, { success: true, message: 'Printing order created successfully', data: result });
    } catch (error: any) {
      return jsonResponse(400, { success: false, message: error.message || 'Failed to create printing order' });
    }
  }

  async getMyOrders(request: Request, url: URL): Promise<Response> {
    const user = getAuthUser(request);
    if (!user) return unauthorizedResponse();
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const filter: Record<string, any> = {};
    url.searchParams.forEach((val, key) => {
      if (key !== 'page' && key !== 'limit') filter[key] = val;
    });
    const result = await ordersService.getUserOrders(user.id, filter, page, limit);
    return jsonResponse(200, { success: true, data: result.orders, total: result.total, page, limit });
  }

  async getMyPrintOrders(request: Request, url: URL): Promise<Response> {
    const user = getAuthUser(request);
    if (!user) return unauthorizedResponse();
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const result = await ordersService.getUserPrintingOrders(user.id, page, limit);
    return jsonResponse(200, { success: true, data: result.orders, total: result.total, page, limit });
  }

  async getMyPrintOrderDetails(request: Request, orderId: string): Promise<Response> {
    const user = getAuthUser(request);
    if (!user) return unauthorizedResponse();
    const order = await ordersService.getUserPrintingOrderDetails(user.id, orderId);
    return jsonResponse(200, { success: true, data: order, message: 'Printing order details fetched successfully' });
  }

  async getNonPrintingOrders(request: Request, url: URL, orderId?: string): Promise<Response> {
    const user = getAuthUser(request);
    if (!user) return unauthorizedResponse();
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const userId = hasRole(user, 'ADMIN') ? (url.searchParams.get('userId') || undefined) : user.id;
    const result = await ordersService.getNonPrintingOrders(userId, orderId, page, limit);

    if (orderId) {
      return jsonResponse(200, { success: true, data: result, message: 'Non-printing order details fetched successfully' });
    }
    return jsonResponse(200, { success: true, data: (result as any).orders, total: (result as any).total, page, limit });
  }

  async bulkUpdateOrders(request: Request): Promise<Response> {
    const user = getAuthUser(request);
    if (!user || !hasRole(user, 'ADMIN')) return forbiddenResponse('Admin role required.');
    const { orderIds, updateData } = await request.json().catch(() => ({}));
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return jsonResponse(400, { success: false, message: 'An array of orderIds is required' });
    }
    const result = await ordersService.bulkUpdateOrders(orderIds, updateData || {});
    return jsonResponse(200, { success: true, message: `${result.modifiedCount} orders updated successfully`, data: result });
  }

  async getAllOrders(request: Request, url: URL): Promise<Response> {
    const user = getAuthUser(request);
    if (!user || (!hasRole(user, 'ADMIN') && !hasRole(user, 'STORE_OWNER'))) {
      return forbiddenResponse('Admin or Store Owner role required.');
    }
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const filter: Record<string, any> = {};
    url.searchParams.forEach((val, key) => {
      if (key !== 'page' && key !== 'limit') filter[key] = val;
    });
    if (hasRole(user, 'STORE_OWNER') && !hasRole(user, 'ADMIN') && !filter.storeId) {
      return jsonResponse(400, { success: false, message: 'storeId is required in query for store owners' });
    }
    const result = await ordersService.getAdminOrders(filter, page, limit);
    return jsonResponse(200, { success: true, data: result.orders, total: result.total, page, limit });
  }

  async getAdminNonPrintingOrders(request: Request, url: URL): Promise<Response> {
    const user = getAuthUser(request);
    if (!user || (!hasRole(user, 'ADMIN') && !hasRole(user, 'STORE_OWNER'))) {
      return forbiddenResponse('Admin or Store Owner role required.');
    }
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const filter: Record<string, any> = {};
    url.searchParams.forEach((val, key) => {
      if (key !== 'page' && key !== 'limit') filter[key] = val;
    });
    if (hasRole(user, 'STORE_OWNER') && !hasRole(user, 'ADMIN') && !filter.storeId) {
      return jsonResponse(400, { success: false, message: 'storeId is required in query for store owners' });
    }
    const result = await ordersService.getAdminNonPrintingOrders(filter, page, limit);
    return jsonResponse(200, { success: true, data: result.orders, total: result.total, page, limit });
  }

  async getOrderCounts(request: Request, url: URL): Promise<Response> {
    const user = getAuthUser(request);
    if (!user || (!hasRole(user, 'ADMIN') && !hasRole(user, 'STORE_OWNER'))) {
      return forbiddenResponse('Admin or Store Owner role required.');
    }
    const filter: Record<string, any> = {};
    url.searchParams.forEach((val, key) => {
      filter[key] = val;
    });
    if (hasRole(user, 'STORE_OWNER') && !hasRole(user, 'ADMIN') && !filter.storeId) {
      return jsonResponse(400, { success: false, message: 'storeId is required in query for store owners' });
    }
    const result = await ordersService.getOrderCounts(filter);
    return jsonResponse(200, { success: true, data: result });
  }

  async getAdminOrderDetails(request: Request, orderId: string): Promise<Response> {
    const user = getAuthUser(request);
    if (!user || (!hasRole(user, 'ADMIN') && !hasRole(user, 'STORE_OWNER'))) {
      return forbiddenResponse('Admin or Store Owner role required.');
    }
    try {
      const order = await ordersService.getAdminOrderDetails(orderId);
      return jsonResponse(200, { success: true, data: order, message: 'Admin order details fetched successfully' });
    } catch (error: any) {
      return jsonResponse(400, { success: false, message: error.message || 'Failed to fetch order details' });
    }
  }

  async getOrderDetails(orderId: string): Promise<Response> {
    const order = await ordersService.getOrderDetails(orderId);
    return jsonResponse(200, { success: true, data: order });
  }

  async updateOrderDetails(request: Request, orderId: string): Promise<Response> {
    const user = getAuthUser(request);
    if (!user || !hasRole(user, 'ADMIN')) return forbiddenResponse('Admin role required.');
    const updatePayload = await request.json().catch(() => ({}));
    const updatedOrder = await ordersService.updateOrderDetails(orderId, updatePayload);
    return jsonResponse(200, { success: true, message: 'Order updated successfully', data: updatedOrder });
  }

  async updateOrderStatus(request: Request, orderId: string): Promise<Response> {
    const user = getAuthUser(request);
    if (!user) return unauthorizedResponse();

    const body = await request.json().catch(() => ({}));
    const { status } = body;

    if (!status) {
      return jsonResponse(400, { success: false, message: 'Status is required in request body.' });
    }

    try {
      const updatedOrder = await ordersService.updateOrderStatus(orderId, status, user);
      return jsonResponse(200, {
        success: true,
        message: 'Order status updated successfully',
        data: updatedOrder,
      });
    } catch (error: any) {
      return jsonResponse(400, { success: false, message: error.message || 'Failed to update order status' });
    }
  }

  async updateOrderStatusFromRoot(request: Request): Promise<Response> {
    const user = getAuthUser(request);
    if (!user) return unauthorizedResponse();

    const body = await request.json().catch(() => ({}));
    const { orderId, status } = body;

    if (!orderId || !status) {
      return jsonResponse(400, { success: false, message: 'Both orderId and status are required in request body.' });
    }

    try {
      const updatedOrder = await ordersService.updateOrderStatus(orderId, status, user);
      return jsonResponse(200, {
        success: true,
        message: 'Order status updated successfully',
        data: updatedOrder,
      });
    } catch (error: any) {
      return jsonResponse(400, { success: false, message: error.message || 'Failed to update order status' });
    }
  }

  async applyPromoCode(request: Request, orderId: string): Promise<Response> {
    const { promoCode } = await request.json().catch(() => ({}));
    if (!promoCode) return jsonResponse(400, { success: false, message: 'Promo Code is required' });
    const updatedOrder = await ordersService.applyPromoCodeToOrder(orderId, promoCode);
    return jsonResponse(200, { success: true, message: 'Promo code applied successfully!', data: updatedOrder });
  }

  async removePromoCode(orderId: string): Promise<Response> {
    const updatedOrder = await ordersService.removePromoCodeFromOrder(orderId);
    return jsonResponse(200, { success: true, message: 'Promo code removed successfully.', data: updatedOrder });
  }

  async processCheckout(request: Request, orderId: string): Promise<Response> {
    const user = getAuthUser(request);
    if (!user) return unauthorizedResponse();
    const payload = await request.json().catch(() => ({}));
    const result = await ordersService.processCheckout(orderId, user.id, payload);
    return jsonResponse(200, { success: true, message: 'Order checkout processed successfully', data: result });
  }

  async getOrderFieldValues(orderId: string): Promise<Response> {
    const fieldValues = await ordersService.getOrderFieldValues(orderId);
    return jsonResponse(200, { success: true, data: fieldValues });
  }
}

export default new OrdersController();
