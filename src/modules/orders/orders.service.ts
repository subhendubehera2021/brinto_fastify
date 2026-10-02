import mongoose, { Types } from 'mongoose';
import { type IOrder, ORDER_STATUSES, type OrderStatus } from '../../models/order.model';
import FormSubmissionModel from '../../models/form-submission.model';
import FieldValueModel from '../../models/field-value.model';
import PromoCodeModel from '../../models/promo-code.model';
import formsDao from '../forms/forms.dao';
import ordersDao from './orders.dao';
import { hasRole } from '../../lib/auth';

export class OrdersService {
  /**
   * Generates or uses provided order ID and saves new order via OrdersDao
   */
  async createNewOrder(userId: string, orderPayload: Partial<IOrder>, storeId?: string, session?: mongoose.ClientSession) {
    const generatedOrderId = orderPayload.orderId || `ORD-${Date.now()}`;
    const totalAmount = orderPayload.totalAmount || 0;
    const discount = orderPayload.discount || 0;
    const grandTotal = Math.max(0, totalAmount - discount);

    const newOrder = await ordersDao.createOrder(
      {
        ...orderPayload,
        orderId: generatedOrderId,
        user: new Types.ObjectId(userId),
        totalAmount,
        discount,
        grandTotal,
        storeId: storeId || orderPayload.storeId || '',
      },
      session
    );

    return newOrder;
  }

  /**
   * Facade method: Creates an order AND saves form submission details + field values
   */
  async createOrderWithDetails(userId: string, payload: any) {
    // 1. BACKEND TRUSTED PRICE CALCULATION & FORM VALIDATION
    const form = await formsDao.getFormById(payload.formObjId);
    if (!form) throw new Error('Form not found.');

    if (!form.isActive) {
      throw new Error('This form is currently inactive.');
    }

    if (form.last_date && new Date() > new Date(form.last_date)) {
      throw new Error('Form has expired.');
    }

    const pricingConfig: any = form.pricing;
    if (!pricingConfig) throw new Error('Form pricing not configured.');

    // Map user answers to a dictionary for condition checking
    const answerMap: Record<string, any> = {};
    if (payload.fieldValues && Array.isArray(payload.fieldValues)) {
      for (const field of payload.fieldValues) {
        const key = field.bindValue || field.fieldName;
        if (key) answerMap[key] = field.value;
      }
    }
    // else if (payload.fieldValues && typeof payload.fieldValues === 'object') {
    //   Object.assign(answerMap, payload.fieldValues);
    //   payload.fieldValues = Object.entries(payload.fieldValues)
    //     .map(([key, value]) => {
    //       const config = (form.inputConfigs as any[]).find(
    //         (cfg) => cfg.inputDef?.bindValue === key || cfg.inputDef?.name === key
    //       );

    //       return {
    //         inputDef: config ? config.inputDef._id : null,
    //         bindValue: config ? config.inputDef.bindValue : key,
    //         fieldName: config ? (config.labelOverride || config.inputDef.name) : key,
    //         value: value,
    //       };
    //     })
    //     .filter((field) => field.inputDef !== null);
    // }

    console.log("Answer Map ==================>", JSON.stringify(answerMap));

    let matchedPriceAmount = 0;
    const rules = pricingConfig.pricingRules || [];

    // Sort rules by priority descending (highest priority evaluates first)
    rules.sort((a: any, b: any) => (b.priority || 0) - (a.priority || 0));

    for (const rule of rules) {
      let isMatch = true;
      const conditionsObj = rule.conditions instanceof Map
        ? Object.fromEntries(rule.conditions)
        : (rule.conditions || {});

      for (const [conditionKey, allowedValues] of Object.entries(conditionsObj)) {
        const userAnswer = answerMap[conditionKey];
        const allowedArray = Array.isArray(allowedValues) ? allowedValues : [allowedValues];

        if (!allowedArray.includes(userAnswer)) {
          isMatch = false;
          break;
        }
      }

      if (isMatch) {
        matchedPriceAmount = rule.price || 0;
        break;
      }
    }

    const applyCharges = pricingConfig.apply_charges || 0;
    const baseDiscount = pricingConfig.discount || 0;
    let totalDiscount = baseDiscount;
    const secureTotalAmount = applyCharges + matchedPriceAmount;

    // 1.5 PROMO CODE VALIDATION & CALCULATION
    let appliedPromoCode = '';
    let promoDiscount = 0;

    if (payload.promoCode) {
      const promo: any = await PromoCodeModel.findOne({ code: payload.promoCode, isActive: true }).lean();
      if (!promo) throw new Error('Invalid or inactive promo code.');

      const now = new Date();
      if (promo.validFrom && now < new Date(promo.validFrom)) throw new Error('Promo code is not yet valid.');
      if (promo.validUntil && now > new Date(promo.validUntil)) throw new Error('Promo code has expired.');
      if (promo.usageLimit && promo.usedCount >= promo.usageLimit) throw new Error('Promo code usage limit reached.');
      if (promo.minOrderAmount && secureTotalAmount < promo.minOrderAmount) {
        throw new Error(`Minimum order amount of ₹${promo.minOrderAmount} required for this promo code.`);
      }

      if (promo.allowedForms && promo.allowedForms.length > 0) {
        const isAllowed = promo.allowedForms.some((id: any) => id.toString() === String(payload.formObjId));
        if (!isAllowed) throw new Error('Promo code is not valid for this form.');
      }

      if (promo.discountType === 'PERCENTAGE') {
        promoDiscount = secureTotalAmount * (promo.discountValue / 100);
        if (promo.maxDiscountAmount) {
          promoDiscount = Math.min(promoDiscount, promo.maxDiscountAmount);
        }
      } else {
        promoDiscount = promo.discountValue;
      }

      const remainingAmount = Math.max(0, secureTotalAmount - baseDiscount);
      promoDiscount = Math.min(promoDiscount, remainingAmount);
      totalDiscount += promoDiscount;
      appliedPromoCode = promo.code;
    }

    // 2. RUN TRANSACTION TO ATOMICALLY SAVE ORDER, SUBMISSION & FIELD VALUES
    const session = await mongoose.startSession();
    try {
      let createdOrder: any;

      await session.withTransaction(async () => {
        createdOrder = await this.createNewOrder(
          userId,
          {
            form: payload.formObjId,
            totalAmount: secureTotalAmount,
            discount: totalDiscount,
            promoCode: appliedPromoCode,
            orderType: payload.orderType || 'NORMAL',
            contactNo: payload.contactNo || '',
          },
          payload.storeId,
          session
        );

        // CREATE THE FORM SUBMISSION
        await FormSubmissionModel.create(
          [
            {
              orderId: createdOrder.orderId,
              user: new Types.ObjectId(userId),
              form: payload.formObjId,
              formId: payload.formId,
              pricingSnapshot: {
                applyCharges,
                matchedRulePrice: matchedPriceAmount,
                baseDiscount,
                promoDiscount,
                totalDiscount,
                totalAmount: secureTotalAmount,
              },
            },
          ],
          { session }
        );

        // SAVE INDIVIDUAL FIELD VALUES
        if (payload.fieldValues && Array.isArray(payload.fieldValues) && payload.fieldValues.length > 0) {
          const mappedFieldValues = payload.fieldValues.map((field: any) => ({
            ...field,
            orderId: createdOrder.orderId,
          }));
          console.log("Mapped Field Values ==================>", JSON.stringify(mappedFieldValues));
          await FieldValueModel.insertMany(mappedFieldValues, { session });
        }
      });

      return createdOrder;
    } catch (err) {
      console.error('Failed to create order transaction:', err);
      throw err;
    } finally {
      await session.endSession();
    }
  }

  async createWhatsappOrder(userId: string, payload: any) {
    const form = await formsDao.getFormById(payload.formObjId);
    if (!form) throw new Error('Form not found.');

    if (!form.isActive) {
      throw new Error('This form is currently inactive.');
    }

    if (form.last_date && new Date() > new Date(form.last_date)) {
      throw new Error('Form has expired.');
    }

    // Generate blank field values for all normal inputs mapped to this form
    const blankFieldValues: any[] = [];
    if (form.inputConfigs && Array.isArray(form.inputConfigs)) {
      for (const config of form.inputConfigs as any[]) {
        if (!config.isNormal) continue;

        const def = config.inputDef;
        if (def) {
          blankFieldValues.push({
            inputDef: def._id,
            fieldName: config.labelOverride || def.name,
            bindValue: def.bindValue,
            value: '',
          });
        }
      }
    }

    const updatedPayload = {
      ...payload,
      orderType: payload.orderType || 'WHATSAPP',
      fieldValues: blankFieldValues,
    };

    return await this.createOrderWithDetails(userId, updatedPayload);
  }

  async createAiOrder(userId: string, payload: any) {
    const form = await formsDao.getFormById(payload.formObjId);
    if (!form) throw new Error('Form not found.');

    if (!form.isActive) {
      throw new Error('This form is currently inactive.');
    }

    if (form.last_date && new Date() > new Date(form.last_date)) {
      throw new Error('Form has expired.');
    }

    // Generate blank field values for all AI inputs mapped to this form
    const blankFieldValues: any[] = [];
    if (form.inputConfigs && Array.isArray(form.inputConfigs)) {
      for (const config of form.inputConfigs as any[]) {
        if (!config.ai) continue;

        const def = config.inputDef;
        if (def) {
          blankFieldValues.push({
            inputDef: def._id,
            fieldName: config.labelOverride || def.name,
            bindValue: def.bindValue,
            value: '',
          });
        }
      }
    }

    const updatedPayload = {
      ...payload,
      orderType: payload.orderType || 'AI',
      fieldValues: blankFieldValues,
    };

    return await this.createOrderWithDetails(userId, updatedPayload);
  }

  async createPrintingOrder(userId: string, payload: any) {
    const updatedPayload = {
      ...payload,
      orderType: 'PRINTING',
    };
    return await this.createNewOrder(userId, updatedPayload);
  }

  async getOrderDetails(orderId: string) {
    const order = await ordersDao.getByOrderId(orderId);
    if (!order) {
      throw new Error('Order not found or has been deleted.');
    }
    return order;
  }

  async getNonPrintingOrders(userId?: string, orderId?: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    return await ordersDao.getNonPrintingOrders(userId, orderId, skip, limit);
  }

  async updateOrderDetails(orderId: string, payload: Partial<IOrder>) {
    const updatedOrder = await ordersDao.updateOrder(orderId, payload);
    if (!updatedOrder) {
      throw new Error('Order not found or could not be updated.');
    }
    return updatedOrder;
  }

  async updateOrderStatus(orderId: string, status: string, user?: any) {
    if (!status) {
      throw new Error('Status is required.');
    }

    const upperStatus = status.trim().toUpperCase() as OrderStatus;
    if (!ORDER_STATUSES.includes(upperStatus)) {
      throw new Error(
        `Invalid status '${status}'. Allowed statuses are: ${ORDER_STATUSES.join(', ')}`
      );
    }

    const existingOrder: any = await ordersDao.getByOrderId(orderId);
    if (!existingOrder) {
      throw new Error('Order not found or has been deleted.');
    }

    const isAdminOrStoreOwner = user && (hasRole(user, 'ADMIN') || hasRole(user, 'STORE_OWNER'));
    const isOwner = user && String(existingOrder.user?._id || existingOrder.user) === String(user.id);

    if (!isAdminOrStoreOwner) {
      if (!isOwner) {
        throw new Error('Forbidden. You do not have permission to update this order.');
      }
      if (upperStatus !== 'CANCELLED') {
        throw new Error('Forbidden. Customers can only cancel their orders.');
      }
      if (['COMPLETED', 'CANCELLED'].includes(existingOrder.status)) {
        throw new Error(`Cannot cancel order because it is already ${existingOrder.status}.`);
      }
    }

    const updatedOrder = await ordersDao.updateOrderStatus(orderId, upperStatus);
    if (!updatedOrder) {
      throw new Error('Order not found or could not be updated.');
    }

    return updatedOrder;
  }

  async bulkUpdateOrders(orderIds: string[], payload: Partial<IOrder>) {
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      throw new Error('No order IDs provided for bulk update.');
    }
    return await ordersDao.bulkUpdateOrders(orderIds, payload);
  }

  async getAdminOrders(filter: any = {}, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    return await ordersDao.getAllOrders(filter, skip, limit);
  }

  async getAdminNonPrintingOrders(filter: any = {}, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    return await ordersDao.getAdminNonPrintingOrders(filter, skip, limit);
  }

  async getOrderCounts(filter: any = {}) {
    return await ordersDao.getOrderCounts(filter);
  }

  async getAdminOrderDetails(orderId: string) {
    const order = await ordersDao.getAdminOrderDetails(orderId);
    if (!order) {
      throw new Error('Order not found or has been deleted.');
    }
    return order;
  }

  async getUserOrders(userId: string, filter: any = {}, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    return await ordersDao.getOrdersByUser(new Types.ObjectId(userId), filter, skip, limit);
  }

  async getUserPrintingOrders(userId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    return await ordersDao.getPrintingOrdersByUser(new Types.ObjectId(userId), skip, limit);
  }

  async getUserPrintingOrderDetails(userId: string, orderId: string) {
    const order = await ordersDao.getPrintingOrderDetailsByUser(orderId, new Types.ObjectId(userId));
    if (!order) {
      throw new Error('Printing order not found or does not belong to the user.');
    }
    return order;
  }

  async applyPromoCodeToOrder(orderId: string, promoCode: string) {
    const order: any = await ordersDao.getByOrderId(orderId);
    if (!order) throw new Error('Order not found.');
    if (order.paymentStatus === 'SUCCESS') {
      throw new Error('Cannot apply promo code. Order is already paid.');
    }

    const updatedOrder = await ordersDao.updateOrder(orderId, { promoCode });
    return updatedOrder;
  }

  async removePromoCodeFromOrder(orderId: string) {
    const order: any = await ordersDao.getByOrderId(orderId);
    if (!order) throw new Error('Order not found.');

    const updatedOrder = await ordersDao.updateOrder(orderId, {
      promoCode: '',
      discount: 0,
      grandTotal: order.totalAmount,
    });
    return updatedOrder;
  }

  async processCheckout(orderId: string, userId: string, payload?: any) {
    const order: any = await ordersDao.getByOrderId(orderId);
    if (!order) throw new Error('Order not found.');

    if (order.paymentStatus === 'SUCCESS' || order.paymentStatus === 'PAID') {
      throw new Error('Order is already paid and checked out.');
    }

    return order;
  }

  async getOrderFieldValues(orderId: string) {
    return await FieldValueModel.find({ orderId }).lean();
  }
}

export default new OrdersService();
