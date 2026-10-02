import { Types } from 'mongoose';
import {
  FormsModel,
  FormOrderCapabilitiesModel,
  FormPricingModel,
  FormInputConfigModel,
  FormQuestionMappingModel,
  DocumentTypeModel,
  InputDefinitionModel,
  type IForms,
  type IFormInputConfig,
} from '../../models/index';

export class FormsDao {
  async getFormBySlug(slugOrId: string): Promise<IForms | null> {
    const query = Types.ObjectId.isValid(slugOrId) ? { _id: slugOrId } : { slug: slugOrId };
    return await FormsModel.findOne(query)
      .populate({
        path: 'inputConfigs',
        model: FormInputConfigModel,
        populate: { path: 'inputDef', model: InputDefinitionModel },
      })
      .populate({ path: 'pricing', model: FormPricingModel })
      .populate({ path: 'orderCapabilities', model: FormOrderCapabilitiesModel })
      .populate({ path: 'requireDocuments', model: DocumentTypeModel })
      .exec();
  }

  async getFormById(id: string | Types.ObjectId): Promise<IForms | null> {
    return await FormsModel.findById(id)
      .populate({
        path: 'inputConfigs',
        model: FormInputConfigModel,
        populate: { path: 'inputDef', model: InputDefinitionModel },
      })
      .populate({ path: 'pricing', model: FormPricingModel })
      .populate({ path: 'orderCapabilities', model: FormOrderCapabilitiesModel })
      .populate({ path: 'requireDocuments', model: DocumentTypeModel })
      .exec();
  }

  async getFormBySlugOrId(slugOrId: string, options: any = {}): Promise<IForms | null> {
    const {
      includeInputs = true,
      includePricing = true,
      includeCapabilities = true,
      includeDocs = true,
      docsFields,
    } = options;

    let query: any;
    if (Types.ObjectId.isValid(slugOrId)) {
      query = { _id: slugOrId };
    } else if (slugOrId.toUpperCase().startsWith('FORM-') || slugOrId.toUpperCase().startsWith('FRM-')) {
      query = { formId: slugOrId };
    } else {
      query = { slug: slugOrId };
    }

    const mongoQuery = FormsModel.findOne({ ...query });

    if (includeInputs) {
      mongoQuery.populate({
        path: 'inputConfigs',
        model: FormInputConfigModel,
        populate: { path: 'inputDef', model: InputDefinitionModel },
      });
    } else {
      mongoQuery.select('-inputConfigs');
    }

    if (includePricing) {
      mongoQuery.populate({ path: 'pricing', model: FormPricingModel });
    } else {
      mongoQuery.select('-pricing');
    }

    if (includeCapabilities) {
      mongoQuery.populate({ path: 'orderCapabilities', model: FormOrderCapabilitiesModel });
    } else {
      mongoQuery.select('-orderCapabilities');
    }

    if (includeDocs) {
      mongoQuery.populate({ path: 'requireDocuments', model: DocumentTypeModel, select: docsFields });
    } else {
      mongoQuery.select('-requireDocuments');
    }

    return await mongoQuery.exec();
  }

  async getAllActiveForms(): Promise<IForms[]> {
    return await FormsModel.find({ isActive: true }).sort({ createdAt: -1 }).exec();
  }

  async getAdminFormsPaginated(filter: any, skip: number, limit: number) {
    const [forms, totalCount] = await Promise.all([
      FormsModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({ path: 'pricing', model: FormPricingModel })
        .populate({ path: 'orderCapabilities', model: FormOrderCapabilitiesModel })
        .exec(),
      FormsModel.countDocuments(filter),
    ]);

    return {
      forms,
      total: totalCount,
      page: Math.floor(skip / limit) + 1,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    };
  }

  async getLatestHomeForms(limit: number): Promise<IForms[]> {
    return await FormsModel.find({ status: 'approved', type: 'job_application_form' })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('name display_img last_date recruitmentboard slug isActive')
      .populate({ path: 'pricing', model: FormPricingModel })
      .exec();
  }

  async getLatestFormsByState(state: string | undefined, limit: number, skip: number = 0): Promise<{ forms: IForms[]; total: number }> {
    const query: any = { status: 'approved', type: 'job_application_form' };
    if (state && state !== 'All') {
      query.state = state;
    } else if (state === undefined) {
      query.state = { $not: /^(central|in|india|all\s*india)$/i };
    }

    const [forms, total] = await Promise.all([
      FormsModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('name display_img last_date recruitmentboard slug isActive state')
        .populate({ path: 'pricing', model: FormPricingModel })
        .exec(),
      FormsModel.countDocuments(query),
    ]);
    return { forms, total };
  }

  async getCentralForms(limit: number, skip: number = 0): Promise<{ forms: IForms[]; total: number }> {
    const query: any = {
      status: 'approved',
      type: 'job_application_form',
      state: { $regex: /^(central|in|india|all\s*india)$/i },
    };
    const [forms, total] = await Promise.all([
      FormsModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('name display_img last_date recruitmentboard slug isActive state')
        .populate({ path: 'pricing', model: FormPricingModel })
        .exec(),
      FormsModel.countDocuments(query),
    ]);
    return { forms, total };
  }

  async createBasicForm(formData: Partial<IForms>): Promise<IForms> {
    const form = new FormsModel(formData);
    return await form.save();
  }

  async updateBasicForm(id: string | Types.ObjectId, formData: Partial<IForms>): Promise<IForms | null> {
    return await FormsModel.findByIdAndUpdate(id, formData, { new: true }).exec();
  }

  async createOrderCapabilities(capData: any) {
    return await FormOrderCapabilitiesModel.create(capData);
  }

  async updateOrderCapabilities(formId: string | Types.ObjectId, capData: any) {
    return await FormOrderCapabilitiesModel.findOneAndUpdate(
      { form: formId },
      capData,
      { new: true, upsert: true }
    ).exec();
  }

  async getFormInputsByFormId(formId: string, filter: any = {}): Promise<IFormInputConfig[]> {
    const query: any = { formId };

    if (filter.isNormal === undefined && filter.ai === undefined) {
      query.isNormal = true;
    } else {
      if (filter.isNormal !== undefined) {
        query.isNormal = filter.isNormal === 'true' || filter.isNormal === true;
      }
      if (filter.ai !== undefined) {
        query.ai = filter.ai === 'true' || filter.ai === true;
      }
    }

    return await FormInputConfigModel.find(query)
      .populate({ path: 'inputDef', model: InputDefinitionModel })
      .sort({ order: 1 })
      .exec();
  }

  async saveInputConfigs(formStringId: string, inputs: any[]) {
    await FormInputConfigModel.deleteMany({ formId: formStringId });

    const savedInputs = await FormInputConfigModel.insertMany(inputs);
    const inputIds = savedInputs.map((input) => input._id);

    await FormsModel.findOneAndUpdate({ formId: formStringId }, { inputConfigs: inputIds }).exec();

    return savedInputs;
  }

  async savePricing(pricingData: any) {
    return await FormPricingModel.findOneAndUpdate(
      { form: pricingData.form },
      pricingData,
      { new: true, upsert: true }
    ).exec();
  }

  async updateFormStatus(id: string | Types.ObjectId, status: string) {
    return await FormsModel.findByIdAndUpdate(id, { status }, { new: true }).exec();
  }

  async updateRequireDocuments(id: string | Types.ObjectId, requireDocuments: string[]) {
    return await FormsModel.findByIdAndUpdate(
      id,
      { requireDocuments },
      { new: true }
    ).populate({ path: 'requireDocuments', model: DocumentTypeModel }).exec();
  }

  async updateRequireDocumentsByFormId(formId: string, requireDocuments: string[]) {
    return await FormsModel.findOneAndUpdate(
      { formId },
      { requireDocuments },
      { new: true }
    ).populate({ path: 'requireDocuments', model: DocumentTypeModel }).exec();
  }

  async getFormQuestions(formId: string) {
    return await FormQuestionMappingModel.findOne({ form_id: formId }).lean();
  }
}

export default new FormsDao();
