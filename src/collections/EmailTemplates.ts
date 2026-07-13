import type {
  CollectionAfterReadHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
} from "payload";
import type {
} from "payload";
import { createEmailRichTextEditor } from "../utils/emailEditor.js";
import { normalizeEmailBodyValue } from "../utils/emailBody.js";

const normalizeLegacyTemplateBody: CollectionBeforeValidateHook = ({ data }) => {
  const typedData = (data ?? {}) as Record<string, unknown>;

  if (typeof typedData.body === "string") {
    return {
      ...typedData,
      body: normalizeEmailBodyValue(typedData.body),
    };
  }

  return typedData;
};

const normalizeLegacyTemplateBodyAfterRead: CollectionAfterReadHook = ({ doc }) => {
  const typedDoc = (doc ?? {}) as Record<string, unknown>;

  if (typeof typedDoc.body === "string") {
    return {
      ...typedDoc,
      body: normalizeEmailBodyValue(typedDoc.body),
    };
  }

  return typedDoc;
};

export const createEmailTemplatesCollection = (
  mediaCollection = "media",
): CollectionConfig => ({
  slug: "email-templates",
  labels: {
    singular: "Имейл шаблон",
    plural: "Имейл шаблони",
  },
  admin: {
    useAsTitle: "name",
    group: "Кампании",
    description: "Преизползваеми шаблони, от които можеш да зареждаш съдържание в имейл кампания.",
  },
  hooks: {
    afterRead: [normalizeLegacyTemplateBodyAfterRead],
    beforeValidate: [normalizeLegacyTemplateBody],
  },
  fields: [
    {
      name: "name",
      label: "Име",
      type: "text",
      required: true,
      admin: {
        description: "Вътрешно име, по което ще разпознаваш шаблона.",
      },
    },
    {
      name: "subject",
      label: "Тема",
      type: "text",
      required: true,
    },
    {
      name: "previewText",
      label: "Прегледен текст",
      type: "text",
      admin: {
        description: "Краткият текст, който някои пощи показват до темата.",
      },
    },
    {
      name: "body",
      label: "Съдържание",
      type: "richText",
      editor: createEmailRichTextEditor(mediaCollection),
      required: true,
      admin: {
        description:
          "Поддържа текст, линкове, списъци и изображения. Променливите {{ firstName }}, {{ lastName }}, {{ email }} и {{ unsubscribeUrl }} също работят.",
      },
    },
    {
      name: "type",
      label: "Тип",
      type: "select",
      required: true,
      defaultValue: "service",
      options: [
        { label: "Служебен", value: "service" },
        { label: "Маркетинг", value: "marketing" },
      ],
    },
  ],
});
