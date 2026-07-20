import { createEmailBroadcastsCollection } from "./collections/EmailBroadcasts.js";
import { emailLogsCollection } from "./collections/EmailLogs.js";
import { createEmailRecipientGroupsCollection } from "./collections/EmailRecipientGroups.js";
import { createEmailTemplatesCollection } from "./collections/EmailTemplates.js";
import { emailSettingsGlobal } from "./globals/EmailSettings.js";
import {
  resolveSnapshotFilterFields,
  type EmailBroadcastGroupFilterField,
} from "./utils/groupFilters.js";
import {
  addRecipientSegmentSyncToCollection,
  validateResendSegments,
  type EmailBroadcastResendSegmentConfig,
} from "./utils/recipientSegmentSync.js";
import type { ResendContactPropertyMapping } from "./utils/resendContacts.js";
import type { Config, Plugin } from "payload";

export {
  buildRecipientPreview,
  loadRecipientPreview,
} from "./utils/recipients.js";
export { buildResendContactSyncPlan } from "./utils/resendContacts.js";
export { validateResendSegments } from "./utils/recipientSegmentSync.js";
export {
  renderResendBroadcastContent,
  RESEND_UNSUBSCRIBE_URL_PLACEHOLDER,
  resendBroadcastRenderData,
} from "./utils/resendBroadcast.js";
export { renderTemplate } from "./utils/renderTemplate.js";
export {
  normalizeEmailBodyValue,
  renderEmailBodyHTML,
  renderEmailLayoutHTML,
} from "./utils/emailBody.js";
export {
  addResendContactToSegment,
  createResendBroadcast,
  createResendContact,
  ResendProviderError,
  removeResendContactFromSegment,
  sendResendBroadcast,
  sendWithResend,
  updateResendContact,
} from "./providers/resend.js";
export type {
  AddResendContactToSegmentArgs,
  AddResendContactToSegmentResult,
  CreateResendBroadcastArgs,
  CreateResendBroadcastResult,
  CreateResendContactArgs,
  CreateResendContactResult,
  ResendContactProperties,
  RemoveResendContactFromSegmentArgs,
  RemoveResendContactFromSegmentResult,
  SendResendBroadcastArgs,
  SendResendBroadcastResult,
  SendWithResendArgs,
  SendWithResendResult,
  UpdateResendContactArgs,
  UpdateResendContactResult,
} from "./providers/resend.js";
export type {
  RecipientPreviewCandidate,
  RecipientPreviewResult,
  RecipientPreviewSummary,
  RecipientPreviewType,
} from "./utils/recipients.js";
export type {
  BuildResendContactSyncPlanArgs,
  BuildResendContactSyncPlanResult,
  ResendContactFieldMapping,
  ResendContactPropertyMapping,
  ResendContactRecipientDoc,
  ResendContactSyncContact,
  ResendContactSyncSkippedRecipient,
} from "./utils/resendContacts.js";
export type {
  RenderResendBroadcastContentArgs,
  RenderResendBroadcastContentResult,
} from "./utils/resendBroadcast.js";
export type { EmailBroadcastResendSegmentConfig } from "./utils/recipientSegmentSync.js";
export type { RenderTemplateData } from "./utils/renderTemplate.js";

export type EmailBroadcastRecipientFields = {
  email: string;
  firstName?: string;
  lastName?: string;
};

export type EmailBroadcastPluginOptions = {
  recipientsCollection?: string;
  usersCollection?: string;
  recipientFields: EmailBroadcastRecipientFields;
  subscriptionField?: string;
  mediaCollection?: string;
  resendApiKey: string;
  resendContactProperties?: ResendContactPropertyMapping[];
  resendSegments?: EmailBroadcastResendSegmentConfig[];
  resendSegmentsFieldName?: string;
  siteUrl?: string;
  defaultFromEmail?: string;
  defaultFromName?: string;
  defaultReplyTo?: string;
  groupFilterFields?: EmailBroadcastGroupFilterField[];
};

export type EmailBroadcastPlugin = Plugin;

export const emailBroadcastPlugin = (
  options: EmailBroadcastPluginOptions,
): EmailBroadcastPlugin => {
  return (config: Config): Config => {
    const recipientCollectionSlug =
      options.recipientsCollection ?? options.usersCollection;

    if (!recipientCollectionSlug) {
      throw new Error(
        "emailBroadcastPlugin requires recipientsCollection or usersCollection.",
      );
    }

    const recipientsCollection = config.collections?.find(
      (collection) => collection.slug === recipientCollectionSlug,
    );
    const resendSegments = validateResendSegments(options.resendSegments);
    const resendSegmentsFieldName =
      options.resendSegmentsFieldName ?? "emailBroadcastSegments";
    const groupFilterFields = resolveSnapshotFilterFields({
      configuredFields: options.groupFilterFields,
      recipientsCollection,
    });

    return {
      ...config,
      collections: [
        ...(config.collections ?? []).map((collection) =>
          collection.slug === recipientCollectionSlug
            ? addRecipientSegmentSyncToCollection({
                collection,
                fieldName: resendSegmentsFieldName,
                recipientEmailField: options.recipientFields.email,
                recipientFirstNameField: options.recipientFields.firstName,
                recipientLastNameField: options.recipientFields.lastName,
                resendApiKey: options.resendApiKey,
                resendContactProperties: options.resendContactProperties,
                segments: resendSegments,
                subscriptionField: options.subscriptionField,
              })
            : collection,
        ),
        createEmailBroadcastsCollection({
          defaultFromEmail: options.defaultFromEmail,
          defaultFromName: options.defaultFromName,
          defaultReplyTo: options.defaultReplyTo,
          mediaCollection: options.mediaCollection,
          recipientsCollection: recipientCollectionSlug,
          recipientEmailField: options.recipientFields.email,
          recipientFirstNameField: options.recipientFields.firstName,
          recipientLastNameField: options.recipientFields.lastName,
          recipientSegmentsFieldName: resendSegmentsFieldName,
          resendApiKey: options.resendApiKey,
          resendContactProperties: options.resendContactProperties,
          resendSegments,
          siteUrl: options.siteUrl,
          subscriptionField: options.subscriptionField,
        }),
        createEmailTemplatesCollection(options.mediaCollection),
        createEmailRecipientGroupsCollection(
          recipientCollectionSlug,
          groupFilterFields,
        ),
        emailLogsCollection,
      ],
      globals: [...(config.globals ?? []), emailSettingsGlobal],
    };
  };
};
