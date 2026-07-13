import { createEmailBroadcastsCollection } from "./collections/EmailBroadcasts.js";
import { emailLogsCollection } from "./collections/EmailLogs.js";
import { createEmailTemplatesCollection } from "./collections/EmailTemplates.js";
import { emailSettingsGlobal } from "./globals/EmailSettings.js";
import type { Config, Plugin } from "payload";

export {
  buildRecipientPreview,
  loadRecipientPreview,
} from "./utils/recipients.js";
export { renderTemplate } from "./utils/renderTemplate.js";
export {
  normalizeEmailBodyValue,
  renderEmailBodyHTML,
  renderEmailLayoutHTML,
} from "./utils/emailBody.js";
export type {
  RecipientPreviewCandidate,
  RecipientPreviewResult,
  RecipientPreviewSummary,
  RecipientPreviewType,
} from "./utils/recipients.js";
export type { RenderTemplateData } from "./utils/renderTemplate.js";

export type EmailBroadcastRecipientFields = {
  email: string;
  firstName?: string;
  lastName?: string;
};

export type EmailBroadcastPluginOptions = {
  usersCollection: string;
  recipientFields: EmailBroadcastRecipientFields;
  subscriptionField?: string;
  unsubscribeTokenField?: string;
  mediaCollection?: string;
  resendApiKey: string;
  defaultFromEmail?: string;
  defaultFromName?: string;
  defaultReplyTo?: string;
};

export type EmailBroadcastPlugin = Plugin;

export const emailBroadcastPlugin = (
  options: EmailBroadcastPluginOptions,
): EmailBroadcastPlugin => {
  return (config: Config): Config => {
    return {
      ...config,
      collections: [
        ...(config.collections ?? []),
        createEmailBroadcastsCollection({
          defaultFromEmail: options.defaultFromEmail,
          defaultFromName: options.defaultFromName,
          defaultReplyTo: options.defaultReplyTo,
          mediaCollection: options.mediaCollection,
          recipientsCollection: options.usersCollection,
          recipientEmailField: options.recipientFields.email,
          recipientFirstNameField: options.recipientFields.firstName,
          recipientLastNameField: options.recipientFields.lastName,
          resendApiKey: options.resendApiKey,
          subscriptionField: options.subscriptionField,
        }),
        createEmailTemplatesCollection(options.mediaCollection),
        emailLogsCollection,
      ],
      globals: [...(config.globals ?? []), emailSettingsGlobal],
    };
  };
};
