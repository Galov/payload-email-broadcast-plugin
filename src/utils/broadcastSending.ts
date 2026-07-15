import type { Payload, PayloadRequest } from "payload";
import { sendWithResend } from "../providers/resend.js";
import {
  renderEmailBodyHTML,
  renderEmailLayoutHTML,
} from "./emailBody.js";
import { renderTemplate } from "./renderTemplate.js";
import {
  asNonEmptyString,
  buildFromAddress,
  resolveBroadcastTemplate,
  resolveRenderData,
  stripHtml,
  type CandidateDoc,
  type SendCommonConfig,
} from "./sendCommon.js";

export const EMAIL_BROADCAST_QUEUE = "email-broadcasts";
export const PREPARE_EMAIL_BROADCAST_TASK = "prepareEmailBroadcast";
export const PROCESS_EMAIL_BROADCAST_BATCH_TASK = "processEmailBroadcastBatch";
export const DEFAULT_EMAIL_BROADCAST_BATCH_SIZE = 25;

export type BroadcastSendConfig = SendCommonConfig & {
  defaultFromEmail?: string;
  defaultFromName?: string;
  defaultReplyTo?: string;
  dryRun?: boolean;
  resendApiKey: string;
  siteUrl?: string;
};

export type QueueEmailBroadcastJobArgs = {
  broadcastId: string;
  payload: Payload;
};

export const queueEmailBroadcastJob = async ({
  broadcastId,
  payload,
}: QueueEmailBroadcastJobArgs) => {
  const jobs = payload.jobs as {
    queue: (args: {
      input: { broadcastId: string };
      overrideAccess?: boolean;
      queue?: string;
      task: string;
    }) => Promise<unknown>;
  };

  await jobs.queue({
    input: { broadcastId },
    overrideAccess: true,
    queue: EMAIL_BROADCAST_QUEUE,
    task: PROCESS_EMAIL_BROADCAST_BATCH_TASK,
  });
};

export const queuePrepareEmailBroadcastJob = async ({
  broadcastId,
  payload,
}: QueueEmailBroadcastJobArgs) => {
  const jobs = payload.jobs as {
    queue: (args: {
      input: { broadcastId: string };
      overrideAccess?: boolean;
      queue?: string;
      task: string;
    }) => Promise<unknown>;
  };

  await jobs.queue({
    input: { broadcastId },
    overrideAccess: true,
    queue: EMAIL_BROADCAST_QUEUE,
    task: PREPARE_EMAIL_BROADCAST_TASK,
  });
};

export const loadRecipientCandidateByID = async ({
  config,
  payload,
  recipientId,
}: {
  config: SendCommonConfig;
  payload: Payload;
  recipientId?: string;
}): Promise<CandidateDoc | undefined> => {
  if (!recipientId) {
    return undefined;
  }

  const doc = (await payload.findByID({
    collection: config.recipientsCollection,
    id: recipientId,
    depth: 0,
    overrideAccess: true,
  })) as Record<string, unknown>;

  return {
    email: doc[config.recipientEmailField],
    id:
      typeof doc.id === "number" || typeof doc.id === "string"
        ? doc.id
        : recipientId,
    ...(config.recipientFirstNameField
      ? { [config.recipientFirstNameField]: doc[config.recipientFirstNameField] }
      : {}),
    ...(config.recipientLastNameField
      ? { [config.recipientLastNameField]: doc[config.recipientLastNameField] }
      : {}),
    ...(config.subscriptionField
      ? { newsletterSubscribed: doc[config.subscriptionField] }
      : {}),
  };
};

export const sendBroadcastEmailToRecipient = async ({
  broadcast,
  candidate,
  config,
  email,
  req,
  settings,
}: {
  broadcast: Record<string, unknown>;
  candidate?: CandidateDoc;
  config: BroadcastSendConfig;
  email: string;
  req: PayloadRequest;
  settings: Record<string, unknown>;
}) => {
  const from = buildFromAddress({
    defaultFromEmail: config.defaultFromEmail,
    defaultFromName: config.defaultFromName,
    settings,
  });

  if (!from) {
    throw new Error("Липсва имейл на изпращача.");
  }

  const renderData = resolveRenderData({
    candidate,
    config,
    email,
    unsubscribeUrl: "https://example.com/unsubscribe",
  });
  const template = await resolveBroadcastTemplate({
    broadcast,
    payload: req.payload,
  });
  const footerText = asNonEmptyString(settings.footerText);
  const previewText = renderTemplate(
    asNonEmptyString(broadcast.previewText) ?? "",
    renderData,
  );
  const bodyHtml = await renderEmailBodyHTML({
    data: renderData,
    req,
    siteUrl: config.siteUrl,
    value: broadcast.body,
  });
  const html = await renderEmailLayoutHTML({
    bodyHtml,
    data: renderData,
    previewText,
    req,
    settingsFooterText: footerText,
    siteUrl: config.siteUrl,
    template,
  });
  const text = [previewText, stripHtml(bodyHtml), footerText]
    .filter((value) => typeof value === "string" && value.trim().length > 0)
    .join("\n\n");

  if (config.dryRun) {
    return {
      providerMessageId: `dry-run-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    };
  }

  return sendWithResend({
    apiKey: config.resendApiKey,
    from,
    html,
    replyTo:
      asNonEmptyString(settings.defaultReplyTo) ??
      config.defaultReplyTo ??
      undefined,
    subject: renderTemplate(
      asNonEmptyString(broadcast.subject) ?? "Имейл кампания",
      renderData,
    ),
    text,
    to: email,
  });
};
