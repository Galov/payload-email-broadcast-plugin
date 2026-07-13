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
  value,
}: {
  data: RenderTemplateData;
  req: PayloadRequest;
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

  return renderTemplate(html, data);
};
