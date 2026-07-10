import { emailBroadcastsCollection } from "./collections/EmailBroadcasts.js";
import { emailLogsCollection } from "./collections/EmailLogs.js";
import { emailTemplatesCollection } from "./collections/EmailTemplates.js";
import { emailSettingsGlobal } from "./globals/EmailSettings.js";
import type { PayloadConfigLike } from "./types.js";

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

export type EmailBroadcastPlugin = <TConfig extends PayloadConfigLike>(
  config: TConfig,
) => TConfig;

export const emailBroadcastPlugin = (
  _options: EmailBroadcastPluginOptions,
): EmailBroadcastPlugin => {
  return <TConfig extends PayloadConfigLike>(config: TConfig): TConfig => {
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
