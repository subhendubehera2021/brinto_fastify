import fieldValuesDao from './field-values.dao';
import type { IFieldValue } from '../../models/field-value.model';

class FieldValuesService {
  async createFieldValue(data: Partial<IFieldValue>): Promise<IFieldValue> {
    return await fieldValuesDao.create(data);
  }

  async createManyFieldValues(data: Partial<IFieldValue>[]): Promise<IFieldValue[]> {
    return await fieldValuesDao.createMany(data);
  }

  async getFieldValuesByOrderId(orderId: string): Promise<IFieldValue[]> {
    return await fieldValuesDao.getByOrderId(orderId);
  }

  async updateFieldValue(id: string, data: Partial<IFieldValue>): Promise<IFieldValue | null> {
    return await fieldValuesDao.update(id, data);
  }

  async deleteFieldValue(id: string): Promise<IFieldValue | null> {
    return await fieldValuesDao.delete(id);
  }
}

export default new FieldValuesService();
