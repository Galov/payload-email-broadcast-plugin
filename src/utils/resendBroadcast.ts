import type { PayloadRequest } from "payload";
import { renderEmailBodyHTML, renderEmailLayoutHTML } from "./emailBody.js";
import { renderTemplate, type RenderTemplateData } from "./renderTemplate.js";
import {
  asNonEmptyString,
  resolveBroadcastTemplate,
  stripHtml,
} from "./sendCommon.js";

export const RESEND_UNSUBSCRIBE_URL_PLACEHOLDER =
  "{{{RESEND_UNSUBSCRIBE_URL}}}";

export const resendBroadcastRenderData: RenderTemplateData = {
  email: "{{{contact.email}}}",
  firstName: "{{{contact.first_name|}}}",
  lastName: "{{{contact.last_name|}}}",
  unsubscribeUrl: RESEND_UNSUBSCRIBE_URL_PLACEHOLDER,
};

export type RenderResendBroadcastContentArgs = {
  broadcast: Record<string, unknown>;
  req: PayloadRequest;
  settings: Record<string, unknown>;
  siteUrl?: string;
};

export type RenderResendBroadcastContentResult = {
  html: string;
  previewText: string;
  subject: string;
  text: string;
};

export const renderResendBroadcastContent = async ({
  broadcast,
  req,
  settings,
  siteUrl,
}: RenderResendBroadcastContentArgs): Promise<RenderResendBroadcastContentResult> => {
  const subject = renderTemplate(
    asNonEmptyString(broadcast.subject) ?? "Имейл кампания",
    resendBroadcastRenderData,
  );
  const previewText = renderTemplate(
    asNonEmptyString(broadcast.previewText) ?? "",
    resendBroadcastRenderData,
  );
  const bodyHtml = await renderEmailBodyHTML({
    data: resendBroadcastRenderData,
    req,
    siteUrl,
    value: broadcast.body,
  });
  const footerText = asNonEmptyString(settings.footerText);
  const template = await resolveBroadcastTemplate({
    broadcast,
    payload: req.payload,
  });
  const html = await renderEmailLayoutHTML({
    bodyHtml,
    data: resendBroadcastRenderData,
    previewText,
    req,
    settingsFooterText: footerText,
    siteUrl,
    template,
  });
  const text = [previewText, stripHtml(bodyHtml), footerText]
    .filter((value) => typeof value === "string" && value.trim().length > 0)
    .join("\n\n");

  return {
    html,
    previewText,
    subject,
    text,
  };
};
