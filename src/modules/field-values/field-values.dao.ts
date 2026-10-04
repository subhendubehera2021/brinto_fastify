import FieldValueModel, { IFieldValue } from '../../models/field-value.model';

class FieldValuesDao {
  async create(data: Partial<IFieldValue>): Promise<IFieldValue> {
    const fieldValue = new FieldValueModel(data);
    return await fieldValue.save();
  }

  async createMany(data: Partial<IFieldValue>[]): Promise<IFieldValue[]> {
    return await FieldValueModel.insertMany(data);
  }

  async getByOrderId(orderId: string): Promise<IFieldValue[]> {
    return await FieldValueModel.find({ orderId }).lean();
  }

  async getById(id: string): Promise<IFieldValue | null> {
    return await FieldValueModel.findById(id).exec();
  }

  async update(id: string, updateData: Partial<IFieldValue>): Promise<IFieldValue | null> {
    return await FieldValueModel.findByIdAndUpdate(id, updateData, { new: true }).exec();
  }

  async delete(id: string): Promise<IFieldValue | null> {
    return await FieldValueModel.findByIdAndDelete(id).exec();
  }
}

export default new FieldValuesDao();
