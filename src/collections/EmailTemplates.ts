import type {
  CollectionAfterReadHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
} from "payload";
import { createEmailRichTextEditor } from "../utils/emailEditor.js";
import { normalizeEmailBodyValue } from "../utils/emailBody.js";

const normalizeLegacyTemplateBody: CollectionBeforeValidateHook = ({ data }) => {
  const typedData = (data ?? {}) as Record<string, unknown>;

  if (typeof typedData.body === "string") {
    typedData.body = normalizeEmailBodyValue(typedData.body);
  }

  if (typeof typedData.footerBody === "string") {
    typedData.footerBody = normalizeEmailBodyValue(typedData.footerBody);
  }

  return {
    ...typedData,
  };
};

const normalizeLegacyTemplateBodyAfterRead: CollectionAfterReadHook = ({ doc }) => {
  const typedDoc = (doc ?? {}) as Record<string, unknown>;

  if (typeof typedDoc.body === "string") {
    typedDoc.body = normalizeEmailBodyValue(typedDoc.body);
  }

  if (typeof typedDoc.footerBody === "string") {
    typedDoc.footerBody = normalizeEmailBodyValue(typedDoc.footerBody);
  }

  return {
    ...typedDoc,
  };
};

const validateHexColor = (value: unknown): true | string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return true;
  }

  return /^#[0-9a-f]{6}$/i.test(value.trim())
    ? true
    : "Използвай цвят във формат #RRGGBB.";
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
      type: "tabs",
      tabs: [
        {
          label: "Съдържание",
          fields: [
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
        },
        {
          label: "Визия",
          fields: [
            {
              name: "headerImage",
              label: "Лого или header изображение",
              type: "upload",
              relationTo: mediaCollection,
              admin: {
                description:
                  "Показва се най-горе в имейла. Ако няма изображение, ще се използва заглавието на хедъра.",
              },
            },
            {
              name: "headerTitle",
              label: "Заглавие в хедъра",
              type: "text",
              admin: {
                description:
                  "Използва се, когато няма избрано изображение за хедъра.",
              },
            },
            {
              name: "primaryColor",
              label: "Основен цвят",
              type: "text",
              defaultValue: "#c70101",
              validate: validateHexColor,
              admin: {
                description: "Използва се за горната линия и линковете. Формат: #RRGGBB.",
              },
            },
            {
              name: "backgroundColor",
              label: "Цвят на фона",
              type: "text",
              defaultValue: "#f3f4f6",
              validate: validateHexColor,
            },
            {
              name: "contentBackgroundColor",
              label: "Цвят на съдържанието",
              type: "text",
              defaultValue: "#ffffff",
              validate: validateHexColor,
            },
            {
              name: "footerBody",
              label: "Футър",
              type: "richText",
              editor: createEmailRichTextEditor(mediaCollection),
              admin: {
                description:
                  "Текстът под основното съдържание. Може да съдържа линкове и променливи.",
              },
            },
            {
              name: "showUnsubscribeLink",
              label: "Показвай линк за отписване",
              type: "checkbox",
              defaultValue: true,
            },
          ],
        },
      ],
    },
  ],
});
