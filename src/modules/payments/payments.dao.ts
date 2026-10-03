import PaymentModel, { type IPayment } from '../../models/payment.model';

export class PaymentsDao {
  async createPayment(data: Partial<IPayment>): Promise<IPayment> {
    return await PaymentModel.create(data);
  }

  async updatePaymentByTransactionId(transactionId: string, data: Partial<IPayment>) {
    return await PaymentModel.findOneAndUpdate(
      { transactionId },
      { $set: data },
      { returnDocument: 'after' }
    ).lean({ virtuals: true });
  }

  async findByTransactionId(transactionId: string) {
    return await PaymentModel.findOne({ transactionId }).lean({ virtuals: true });
  }

  async getPaymentsByOrder(orderId: string) {
    return await PaymentModel.find({ orderId }).sort({ createdAt: -1 }).lean({ virtuals: true });
  }
}

export default new PaymentsDao();
