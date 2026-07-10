import { emailBroadcastsCollection } from "./collections/EmailBroadcasts.js";
import { emailLogsCollection } from "./collections/EmailLogs.js";
import { emailTemplatesCollection } from "./collections/EmailTemplates.js";
import { emailSettingsGlobal } from "./globals/EmailSettings.js";
import type { Config, Plugin } from "payload";

export {
  buildRecipientPreview,
  loadRecipientPreview,
} from "./utils/recipients.js";
export { renderTemplate } from "./utils/renderTemplate.js";
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
  resendApiKey: string;
  defaultFromEmail?: string;
  defaultFromName?: string;
  defaultReplyTo?: string;
};

export type EmailBroadcastPlugin = Plugin;

export const emailBroadcastPlugin = (
  _options: EmailBroadcastPluginOptions,
): EmailBroadcastPlugin => {
  return (config: Config): Config => {
    return {
      ...config,
      collections: [
        ...(config.collections ?? []),
        emailBroadcastsCollection,
        emailTemplatesCollection,
        emailLogsCollection,
      ],
      globals: [...(config.globals ?? []), emailSettingsGlobal],
    };
  };
};
