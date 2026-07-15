import {
  buildDefaultEditorState,
  defaultRichTextValue,
  getPayloadPopulateFn,
} from "@payloadcms/richtext-lexical";
import { convertLexicalToHTMLAsync } from "@payloadcms/richtext-lexical/html-async";
import type { SerializedEditorState } from "@payloadcms/richtext-lexical/lexical";
import type { PayloadRequest } from "payload";
import { renderTemplate, type RenderTemplateData } from "./renderTemplate.js";

type RichTextValue = {
  root?: {
    children?: unknown[];
  };
};

const isRichTextValue = (value: unknown): value is RichTextValue => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const typedValue = value as RichTextValue;

  return Boolean(
    typedValue.root &&
      typeof typedValue.root === "object" &&
      Array.isArray(typedValue.root.children),
  );
};

export const normalizeEmailBodyValue = (
  value: unknown,
): SerializedEditorState => {
  if (typeof value === "string") {
    return buildDefaultEditorState({ text: value }) as SerializedEditorState;
  }

  if (isRichTextValue(value)) {
    return value as SerializedEditorState;
  }

  return defaultRichTextValue as SerializedEditorState;
};

export const renderEmailBodyHTML = async ({
  data,
  req,
  siteUrl,
  value,
}: {
  data: RenderTemplateData;
  req: PayloadRequest;
  siteUrl?: string;
  value: unknown;
}) => {
  const normalizedValue = normalizeEmailBodyValue(value);
  const populate = await getPayloadPopulateFn({
    currentDepth: 0,
    depth: 1,
    overrideAccess: true,
    req,
  });

  const html = await convertLexicalToHTMLAsync({
    data: normalizedValue,
    disableContainer: true,
    populate,
  });

  return absolutizeHtmlUrls({
    html: renderTemplate(html, data),
    siteUrl,
  });
};

const asNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  return normalized.length > 0 ? normalized : null;
};

const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const makeAbsoluteUrl = ({
  siteUrl,
  url,
}: {
  siteUrl?: string;
  url: string;
}) => {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  const normalizedSiteUrl = asNonEmptyString(siteUrl);

  if (!normalizedSiteUrl || !url.startsWith("/")) {
    return url;
  }

  return `${normalizedSiteUrl.replace(/\/$/, "")}${url}`;
};

const absolutizeHtmlUrls = ({
  html,
  siteUrl,
}: {
  html: string;
  siteUrl?: string;
}) => {
  return html.replace(
    /\s(src|href)=("|')([^"']+)\2/gi,
    (match, attribute: string, quote: string, url: string) => {
      return ` ${attribute}=${quote}${makeAbsoluteUrl({ siteUrl, url })}${quote}`;
    },
  );
};

const getUploadUrl = ({
  siteUrl,
  value,
}: {
  siteUrl?: string;
  value: unknown;
}): string | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const upload = value as Record<string, unknown>;
  const url = asNonEmptyString(upload.url);

  return url ? makeAbsoluteUrl({ siteUrl, url }) : null;
};

const isHexColor = (value: string | null): value is string => {
  return Boolean(value && /^#[0-9a-f]{6}$/i.test(value));
};

export const renderEmailLayoutHTML = async ({
  bodyHtml,
  data,
  previewText,
  req,
  settingsFooterText,
  siteUrl,
  template,
  testNotice,
}: {
  bodyHtml: string;
  data: RenderTemplateData;
  previewText?: string;
  req: PayloadRequest;
  settingsFooterText?: string | null;
  siteUrl?: string;
  template?: Record<string, unknown> | null;
  testNotice?: string;
}) => {
  const templatePrimaryColor = asNonEmptyString(template?.primaryColor);
  const templateBackgroundColor = asNonEmptyString(template?.backgroundColor);
  const templateContentBackgroundColor = asNonEmptyString(
    template?.contentBackgroundColor,
  );
  const primaryColor = isHexColor(templatePrimaryColor)
    ? templatePrimaryColor
    : "#c70101";
  const backgroundColor = isHexColor(templateBackgroundColor)
    ? templateBackgroundColor
    : "#f3f4f6";
  const contentBackgroundColor = isHexColor(templateContentBackgroundColor)
    ? templateContentBackgroundColor
    : "#ffffff";
  const headerImageUrl = getUploadUrl({
    siteUrl,
    value: template?.headerImage,
  });
  const headerTitle =
    asNonEmptyString(template?.headerTitle) ??
    asNonEmptyString(template?.name) ??
    "";
  const renderedFooterBody = template?.footerBody
    ? await renderEmailBodyHTML({
        data,
        req,
        siteUrl,
        value: template.footerBody,
      })
    : "";
  const fallbackFooterText = settingsFooterText
    ? `<p>${escapeHtml(renderTemplate(settingsFooterText, data))}</p>`
    : "";
  const unsubscribeUrl = asNonEmptyString(data.unsubscribeUrl);
  const unsubscribeBlock =
    template?.showUnsubscribeLink === false || !unsubscribeUrl
      ? ""
      : `<p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:#6b7280;">Ако не искаш да получаваш тези имейли, можеш да се <a href="${escapeHtml(unsubscribeUrl)}" style="color:${primaryColor};">отпишеш оттук</a>.</p>`;
  const footerHtml = [renderedFooterBody || fallbackFooterText, unsubscribeBlock]
    .filter(Boolean)
    .join("");
  const headerHtml = [
    headerImageUrl
      ? `<img src="${escapeHtml(headerImageUrl)}" alt="${escapeHtml(headerTitle)}" style="display:block;max-width:220px;width:auto;height:auto;border:0;margin:0 auto;" />`
      : "",
    headerTitle
      ? `<div style="margin:${headerImageUrl ? "18px" : "0"} 0 0;font-family:Arial,sans-serif;font-size:24px;line-height:1.25;font-weight:700;color:#ffffff;text-align:center;">${escapeHtml(headerTitle)}</div>`
      : "",
  ].join("");

  return [
    '<!doctype html>',
    '<html>',
    '<body style="margin:0;padding:0;background:' + backgroundColor + ';">',
    previewText
      ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(previewText)}</div>`
      : "",
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:' +
      backgroundColor +
      ';padding:28px 12px;">',
    "<tr><td align=\"center\">",
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:' +
      backgroundColor +
      ';border-radius:18px;overflow:hidden;border:1px solid #e5e7eb;">',
    headerHtml
      ? `<tr><td align="center" style="padding:28px 34px;background:${primaryColor};">${headerHtml}</td></tr>`
      : `<tr><td style="height:28px;background:${primaryColor};font-size:0;line-height:0;">&nbsp;</td></tr>`,
    `<tr><td style="background:${contentBackgroundColor};padding:24px 34px 34px;font-family:Arial,sans-serif;font-size:16px;line-height:1.65;color:#111827;">${testNotice ? `<p style="margin:0 0 20px;padding:12px 16px;border:1px solid #d0d7de;border-radius:10px;background:#f6f8fa;"><strong>Тестов имейл.</strong> ${escapeHtml(testNotice)}</p>` : ""}${bodyHtml}</td></tr>`,
    footerHtml
      ? `<tr><td style="background:${contentBackgroundColor};padding:22px 34px 30px;border-top:1px solid #e5e7eb;font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#6b7280;">${footerHtml}</td></tr>`
        : "",
    "</table>",
    "</td></tr>",
    "</table>",
    "</body>",
    "</html>",
  ].join("");
};
