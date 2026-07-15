import { createEmailBroadcastsCollection } from "./collections/EmailBroadcasts.js";
import { emailLogsCollection } from "./collections/EmailLogs.js";
import { createEmailRecipientGroupsCollection } from "./collections/EmailRecipientGroups.js";
import { createEmailTemplatesCollection } from "./collections/EmailTemplates.js";
import { emailSettingsGlobal } from "./globals/EmailSettings.js";
import { createPrepareEmailBroadcastTask } from "./jobs/prepareBroadcast.js";
import { createProcessEmailBroadcastBatchTask } from "./jobs/processBroadcastBatch.js";
import {
  resolveSnapshotFilterFields,
  type EmailBroadcastGroupFilterField,
} from "./utils/groupFilters.js";
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
  siteUrl?: string;
  defaultFromEmail?: string;
  defaultFromName?: string;
  defaultReplyTo?: string;
  dryRun?: boolean;
  groupFilterFields?: EmailBroadcastGroupFilterField[];
};

export type EmailBroadcastPlugin = Plugin;

export const emailBroadcastPlugin = (
  options: EmailBroadcastPluginOptions,
): EmailBroadcastPlugin => {
  return (config: Config): Config => {
    const recipientsCollection = config.collections?.find(
      (collection) => collection.slug === options.usersCollection,
    );
    const groupFilterFields = resolveSnapshotFilterFields({
      configuredFields: options.groupFilterFields,
      recipientsCollection,
    });

    return {
      ...config,
      collections: [
        ...(config.collections ?? []),
        createEmailBroadcastsCollection({
          defaultFromEmail: options.defaultFromEmail,
          defaultFromName: options.defaultFromName,
          defaultReplyTo: options.defaultReplyTo,
          dryRun: options.dryRun,
          mediaCollection: options.mediaCollection,
          recipientsCollection: options.usersCollection,
          recipientEmailField: options.recipientFields.email,
          recipientFirstNameField: options.recipientFields.firstName,
          recipientLastNameField: options.recipientFields.lastName,
          resendApiKey: options.resendApiKey,
          siteUrl: options.siteUrl,
          subscriptionField: options.subscriptionField,
        }),
        createEmailTemplatesCollection(options.mediaCollection),
        createEmailRecipientGroupsCollection(
          options.usersCollection,
          groupFilterFields,
        ),
        emailLogsCollection,
      ],
      globals: [...(config.globals ?? []), emailSettingsGlobal],
      jobs: {
        ...config.jobs,
        tasks: [
          ...(config.jobs?.tasks ?? []),
          createPrepareEmailBroadcastTask({
            defaultFromEmail: options.defaultFromEmail,
            defaultFromName: options.defaultFromName,
            defaultReplyTo: options.defaultReplyTo,
            dryRun: options.dryRun,
            recipientEmailField: options.recipientFields.email,
            recipientFirstNameField: options.recipientFields.firstName,
            recipientLastNameField: options.recipientFields.lastName,
            recipientsCollection: options.usersCollection,
            resendApiKey: options.resendApiKey,
            siteUrl: options.siteUrl,
            subscriptionField: options.subscriptionField,
          }),
          createProcessEmailBroadcastBatchTask({
            defaultFromEmail: options.defaultFromEmail,
            defaultFromName: options.defaultFromName,
            defaultReplyTo: options.defaultReplyTo,
            dryRun: options.dryRun,
            recipientEmailField: options.recipientFields.email,
            recipientFirstNameField: options.recipientFields.firstName,
            recipientLastNameField: options.recipientFields.lastName,
            recipientsCollection: options.usersCollection,
            resendApiKey: options.resendApiKey,
            siteUrl: options.siteUrl,
            subscriptionField: options.subscriptionField,
          }),
        ],
      },
    };
  };
};
