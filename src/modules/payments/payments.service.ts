import { Types } from 'mongoose';
import paymentsDao from './payments.dao';
import ordersDao from '../orders/orders.dao';
import cashFreeService, { type CashfreeUser } from '../../lib/cashfree';

export interface CreatePaymentPayload {
  order: string;
  return_url?: string;
  order_note?: string;
  isSandbox?: boolean;
}

export class PaymentsService {
  async createPayment(user: CashfreeUser & { id?: string; _id?: string }, payload: CreatePaymentPayload) {
    const orderIdOrObjId = payload.order;
    if (!orderIdOrObjId) {
      throw new Error('Order ID or ObjectId is required.');
    }

    const orderDetails: any = await ordersDao.getByOrderId(orderIdOrObjId);
    if (!orderDetails) {
      throw new Error('No order found!');
    }

    // Check if the order is already marked as paid
    const isAlreadyPaid =
      orderDetails.paymentStatus === 'SUCCESS' ||
      orderDetails.payments?.some((p: any) => p.status === 'SUCCESS');

    if (isAlreadyPaid) {
      throw new Error('Payment has already been made for this order.');
    }

    const isSandbox = Boolean(payload.isSandbox);
    const cashFreePayload = {
      amount: orderDetails.grandTotal,
      order_note: payload.order_note || `payment for order ${orderDetails.orderId}`,
      return_url: payload.return_url || '',
    };

    // Call CashFreeService (handles Sandbox vs Production environment cleanly)
    const payment = await cashFreeService.createOrder(user, cashFreePayload, isSandbox);

    const userIdStr = user.id || user._id || user.user_id;
    const paymentRecord = await paymentsDao.createPayment({
      user: new Types.ObjectId(userIdStr),
      order: new Types.ObjectId(orderDetails._id),
      orderId: orderDetails.orderId,
      amount: payment.order_amount,
      transactionId: payment.order_id,
      orderType: 'ORDER',
      status: 'initiated',
      paymentDate: new Date(),
    });

    return { payment, paymentCreated: paymentRecord };
  }

  async verifyWebhook(transactionId: string, isSandbox: boolean = false) {
    const orderData = await cashFreeService.verifyOrder(transactionId, isSandbox);
    if (!orderData) {
      throw new Error('Could not verify payment status from Cashfree');
    }

    const payment = await paymentsDao.findByTransactionId(orderData.order_id as string);
    if (!payment) {
      throw new Error('Payment record not found for this transaction.');
    }

    if (payment.status === 'SUCCESS') {
      return { orderData, updatedPayment: payment };
    }

    const newStatus = orderData.order_status === 'PAID' ? 'SUCCESS' : String(orderData.order_status);

    const updatedPayment = await paymentsDao.updatePaymentByTransactionId(orderData.order_id as string, {
      status: newStatus,
      method: (orderData as any).payment_group as any || 'unknown',
      paymentDetails: orderData,
    });

    let orderPaymentStatus: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED' = 'PENDING';
    if (newStatus === 'SUCCESS') {
      orderPaymentStatus = 'SUCCESS';
    } else if (['FAILED', 'USER_DROPPED', 'CANCELLED'].includes(newStatus)) {
      orderPaymentStatus = 'FAILED';
    }

    await ordersDao.updateOrder(payment.orderId, { paymentStatus: orderPaymentStatus });
    return { orderData, updatedPayment };
  }
}

export default new PaymentsService();
