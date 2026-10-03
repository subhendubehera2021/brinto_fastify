/**
 * v2 models — new architecture
 *
 * Model name mapping from production:
 *  form_input_mappings              →  input-definition.model
 *  (new junction)                   →  form-input-config.model
 *  forms                            →  forms.model
 *  rto + scholarship + admission
 *    + popular + form_*_mappings    →  form-display-config.model
 *  submited_forms                   →  form-submission.model
 *  submitted_form_details           →  field-value.model
 *  orders + drafts                  →  order.model  (DRAFT status replaces drafts)
 */

export { default as InputDefinitionModel }        from './input-definition.model';
export { default as DocumentTypeModel }           from './document-type.model';
export { default as FormInputConfigModel }        from './form-input-config.model';
export { default as FormsModel }                  from './forms.model';
export { default as FormDisplayConfigModel }      from './form-display-config.model';
export { default as FormSubmissionModel }         from './form-submission.model';
export { default as FieldValueModel }             from './field-value.model';
export { default as OrderModel }                  from './order.model';
export { default as FormOrderCapabilitiesModel }  from './form-order-capabilities.model';
export { default as FormPricingModel }            from './form-pricing.model';
export { default as PromoCodeModel }              from './promo-code.model';
export { default as PaymentModel }                from './payment.model';
export { default as RecruitmentBoardModel }       from './recruitment-boards.model';
export { default as RecruitmentBoardFollowModel } from './recruitment-board-follow.model';
export { default as FeedModel }                   from './feeds.model';
export { default as FormQuestionMappingModel }    from './form-question-mapping.model';
export { default as FormQuestionAnswerModel }     from './form-question-answer.model';

export { default as UserModel }                  from './users.model';
export { default as SubscriptionPlanModel }       from './subscription-plans';
export { default as OrderResultModel }            from './order-result.model';
export { default as OrderAdditionalDocsModel }    from './order-additional-docs.model';
export { default as UserStoreModel }               from './user-store.model';
export { default as StoreFormModel }               from './store-form.model';
export { default as StoreSubscriptionModel }       from './store-subscription.model';

export type { IInputDefinition }       from './input-definition.model';
export type { IDocumentType }          from './document-type.model';
export type { IFormInputConfig }       from './form-input-config.model';
export type { IForms }                 from './forms.model';
export type { IFormDisplayConfig, DisplayType } from './form-display-config.model';
export type { IFormSubmission }        from './form-submission.model';
export type { IFieldValue }            from './field-value.model';
export type { IOrder }                 from './order.model';
export type { IFormOrderCapabilities } from './form-order-capabilities.model';
export type { IFormPricing }           from './form-pricing.model';
export type { IPromoCode }             from './promo-code.model';
export type { IPayment }               from './payment.model';
export type { IRecruitmentBoard }      from './recruitment-boards.model';
export type { IRecruitmentBoardFollow } from './recruitment-board-follow.model';
export type { IFeed, IPostAttachment } from './feeds.model';
export type { IFormQuestionMapping }   from './form-question-mapping.model';
export type { IFormQuestionAnswer }    from './form-question-answer.model';
export type { IUsers }                 from './users.model';
export type { ISubscriptionPlan }      from './subscription-plans';
export type { IUserStore }             from './user-store.model';
export type { IStoreForm }             from './store-form.model';
export type { IStoreSubscription }     from './store-subscription.model';
