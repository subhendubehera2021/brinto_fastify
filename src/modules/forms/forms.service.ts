import formsDao from './forms.dao';

export class HomeFormResponse {
  _id: string;
  slug: string;
  name: string;
  display_img: string;
  last_date: Date;
  recruitmentboard: string;
  apply_charges: number;
  isActive: boolean;
  state: string;

  constructor(data: any) {
    this._id = data._id?.toString() || '';
    this.slug = data.slug || '';
    this.name = data.name || '';
    this.display_img = data.display_img || '';
    this.last_date = data.last_date;
    this.recruitmentboard = data.recruitmentboard || '';
    this.apply_charges = data.pricing?.apply_charges || 0;
    this.isActive = data.isActive || false;
    this.state = data.state || '';
  }
}

export class FormsService {
  async getFormDetails(slug: string) {
    const form = await formsDao.getFormBySlug(slug);
    if (!form) {
      throw new Error('Form not found or is inactive.');
    }

    const formObj: any = form.toJSON();

    if (formObj.inputConfigs && Array.isArray(formObj.inputConfigs)) {
      formObj.inputConfigs = formObj.inputConfigs.map((config: any) => {
        const def = config.inputDef || {};
        return {
          configId: config._id,
          inputId: def._id,
          name: config.labelOverride || def.name,
          placeholder: config.placeholderOverride || def.placeholder,
          type: def.type,
          options: def.options || [],
          acceptedTypes: def.acceptedTypes || '',
          bindValue: def.bindValue,
          required: config.required,
          order: config.order,
          isVisible: config.isVisible,
          group: config.group,
          fileDescription: config.fileDescription,
          sampleImage: def.sampleImage || null,
          isNormal: config.isNormal,
          ai: config.ai,
        };
      });
    }

    return formObj;
  }

  async getFormDetailsNew(slugOrId: string, options: any = {}) {
    const form = await formsDao.getFormBySlugOrId(slugOrId, options);
    if (!form) {
      throw new Error('Form not found or is inactive.');
    }
    return form;
  }

  async getFormBySlugOrId(slugOrId: string, options: any = {}) {
    const form = await formsDao.getFormBySlugOrId(slugOrId, options);
    if (!form) {
      throw new Error('Form not found or is inactive.');
    }

    const formObj: any = form.toJSON();

    if (options.includeInputs !== false && formObj.inputConfigs && Array.isArray(formObj.inputConfigs)) {
      formObj.inputConfigs = formObj.inputConfigs.map((config: any) => {
        const def = config.inputDef || {};
        return {
          configId: config._id,
          inputId: def._id,
          name: config.labelOverride || def.name,
          placeholder: config.placeholderOverride || def.placeholder,
          type: def.type,
          options: def.options || [],
          acceptedTypes: def.acceptedTypes || '',
          bindValue: def.bindValue,
          required: config.required,
          order: config.order,
          isVisible: config.isVisible,
          group: config.group,
          fileDescription: config.fileDescription,
          sampleImage: def.sampleImage || null,
          isNormal: config.isNormal,
          ai: config.ai,
        };
      });
    }

    return formObj;
  }

  async getMinimalFormDetails(slugOrId: string) {
    const form = await formsDao.getFormBySlugOrId(slugOrId);
    if (!form) {
      throw new Error('Form not found or is inactive.');
    }

    const formObj: any = form.toJSON();

    let inputFields = [];
    if (formObj.inputConfigs && Array.isArray(formObj.inputConfigs)) {
      inputFields = formObj.inputConfigs.map((config: any) => {
        const def = config.inputDef || {};
        return {
          configId: config._id,
          inputId: def._id,
          name: config.labelOverride || def.name,
          placeholder: config.placeholderOverride || def.placeholder,
          type: def.type,
          options: def.options || [],
          acceptedTypes: def.acceptedTypes || '',
          bindValue: def.bindValue,
          required: config.required,
          order: config.order,
          isVisible: config.isVisible,
          group: config.group,
          fileDescription: config.fileDescription,
          sampleImage: def.sampleImage || null,
          isNormal: config.isNormal,
          ai: config.ai,
        };
      });
    }

    return {
      _id: formObj._id,
      formId: formObj.formId,
      slug: formObj.slug,
      name: formObj.name,
      state: formObj.state,
      recruitmentboard: formObj.recruitmentboard,
      display_img: formObj.display_img,
      inputFields,
    };
  }

  transformToV1(v2Form: any) {
    if (!v2Form) return v2Form;

    const v1Form = { ...v2Form };

    if (v1Form.inputConfigs) {
      v1Form.inputMappings = v1Form.inputConfigs
        .filter((config: any) => config.isNormal !== false)
        .map((config: any) => ({
          _id: config.configId || config.inputId,
          name: config.name,
          type: config.type,
          placeholder: config.placeholder,
          options: config.options || [],
          bindValue: config.bindValue,
          required: config.required,
          acceptedTypes: config.acceptedTypes,
          fileDescription: config.fileDescription || 'PDF, JPG or PNG (max 5MB)',
          sampleImage: config.sampleImage || null,
          formId: v1Form.formId,
          __v: 0,
          createdAt: v1Form.createdAt,
          updatedAt: v1Form.updatedAt,
        }));
      delete v1Form.inputConfigs;
    }

    if (Array.isArray(v1Form.requireDocuments)) {
      v1Form.requireDocuments = v1Form.requireDocuments.map((doc: any) => doc.name);
    }

    if (v1Form.pricing) {
      v1Form.apply_charges = v1Form.pricing.apply_charges || 0;
      v1Form.discount = v1Form.pricing.discount || 0;
      v1Form.prebooking_apply_charges = v1Form.pricing.prebooking_apply_charges || 0;
      v1Form.sale_apply_charges = v1Form.pricing.sale_apply_charges || 0;
      v1Form.pricingRules = v1Form.pricing.pricingRules || [];

      v1Form.price = [
        {
          category: 'Basic',
          amount: 0,
          totalChargess: v1Form.pricing.apply_charges || 0,
          _id: v1Form.pricing._id || v1Form._id,
        },
      ];
      delete v1Form.pricing;
    } else {
      v1Form.apply_charges = 0;
      v1Form.discount = 0;
      v1Form.prebooking_apply_charges = 0;
      v1Form.sale_apply_charges = 0;
      v1Form.pricingRules = [];
      v1Form.price = [{ category: 'Basic', amount: 0, totalChargess: 0, _id: v1Form._id }];
    }

    if (v1Form.orderCapabilities) {
      v1Form.isAcceptWhatsappOrder = v1Form.orderCapabilities.whatsapp || false;
      v1Form.isAcceptNormalOrder = v1Form.orderCapabilities.normal || false;
      v1Form.isAcceptAiOrder = v1Form.orderCapabilities.ai || false;
      v1Form.isPrebook = v1Form.orderCapabilities.prebook || false;
      delete v1Form.orderCapabilities;
    } else {
      v1Form.isAcceptWhatsappOrder = false;
      v1Form.isAcceptNormalOrder = false;
      v1Form.isAcceptAiOrder = false;
      v1Form.isPrebook = false;
    }

    return v1Form;
  }

  async getFormsList() {
    return await formsDao.getAllActiveForms();
  }

  async getAdminFormsPaginated(page: number, limit: number, search: string, status: string) {
    const skip = (page - 1) * limit;
    const filter: any = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { formId: { $regex: search, $options: 'i' } },
      ];
    }
    if (status && status !== 'all') {
      filter.status = status;
    }

    const paginatedData = await formsDao.getAdminFormsPaginated(filter, skip, limit);
    return {
      ...paginatedData,
      forms: paginatedData.forms.map((f: any) => this.transformToV1(f.toJSON ? f.toJSON() : f)),
    };
  }

  async getLatestHomeForms(): Promise<HomeFormResponse[]> {
    const forms = await formsDao.getLatestHomeForms(8);
    return forms.map((form) => new HomeFormResponse(form));
  }

  async getLatestFormsByState(state: string | undefined, page: number = 1, limit: number = 8) {
    const skip = (page - 1) * limit;
    const { forms, total } = await formsDao.getLatestFormsByState(state, limit, skip);
    return {
      forms: forms.map((form) => new HomeFormResponse(form)),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getCentralForms(page: number = 1, limit: number = 8) {
    const skip = (page - 1) * limit;
    const { forms, total } = await formsDao.getCentralForms(limit, skip);
    return {
      forms: forms.map((form) => new HomeFormResponse(form)),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async processStep1(payload: any) {
    const generatedFormId = payload.formId || `FRM-${Date.now()}`;

    const form = await formsDao.createBasicForm({
      ...payload.formDetails,
      formId: generatedFormId,
      status: 'draft',
    });

    if (payload.orderCapabilities) {
      await formsDao.createOrderCapabilities({
        ...payload.orderCapabilities,
        form: form._id,
      });
    }
    return form;
  }

  async updateStep1(id: string, payload: any) {
    const form = await formsDao.updateBasicForm(id, payload.formDetails || {});
    if (!form) {
      throw new Error('Form not found.');
    }

    if (payload.orderCapabilities) {
      await formsDao.updateOrderCapabilities(id, {
        ...payload.orderCapabilities,
        form: id,
      });
    }
    return form;
  }

  async getFormInputs(formId: string, filter: any = {}) {
    const configs = await formsDao.getFormInputsByFormId(formId, filter);
    return configs.map((config: any) => {
      const def = config.inputDef || {};
      return {
        configId: config._id,
        inputId: def._id,
        name: config.labelOverride || def.name,
        placeholder: config.placeholderOverride || def.placeholder,
        type: def.type,
        options: def.options || [],
        acceptedTypes: def.acceptedTypes || '',
        bindValue: def.bindValue,
        required: config.required,
        order: config.order,
        isVisible: config.isVisible,
        group: config.group,
        fileDescription: config.fileDescription,
        sampleImage: def.sampleImage || null,
        isNormal: config.isNormal,
        ai: config.ai,
      };
    });
  }

  async processStep2(formStringId: string, inputsPayload: any[]) {
    const mappedInputs = inputsPayload.map((input) => ({
      ...input,
      formId: formStringId,
    }));

    await formsDao.saveInputConfigs(formStringId, mappedInputs);
    return { message: 'Inputs mapped successfully', count: mappedInputs.length };
  }

  async processStep3(formObjId: string, pricingPayload: any) {
    await formsDao.savePricing({
      ...pricingPayload,
      form: formObjId,
    });

    return await formsDao.updateFormStatus(formObjId, 'active');
  }

  async updateRequireDocuments(formObjId: string, documentIds: string[]) {
    return await formsDao.updateRequireDocuments(formObjId, documentIds);
  }

  async updateRequireDocumentsByFormId(formId: string, documentIds: string[]) {
    return await formsDao.updateRequireDocumentsByFormId(formId, documentIds);
  }

  async getFormQuestions(formId: string) {
    const mapping = await formsDao.getFormQuestions(formId);
    if (!mapping) {
      throw new Error('No question mapping found for this form');
    }
    return mapping.questions;
  }
}

export default new FormsService();
