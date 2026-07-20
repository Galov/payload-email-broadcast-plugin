import type {
  CollectionAfterReadHook,
  CollectionBeforeChangeHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
} from "payload";
import { createBroadcastDraftEndpoint } from "../endpoints/createBroadcastDraft.js";
import { createSendResendBroadcastEndpoint } from "../endpoints/sendResendBroadcast.js";
import { createSendSummaryEndpoint } from "../endpoints/sendSummary.js";
import { createSendTestEndpoint } from "../endpoints/sendTest.js";
import { createSyncAudienceEndpoint } from "../endpoints/syncAudience.js";
import { createEmailRichTextEditor } from "../utils/emailEditor.js";
import { normalizeEmailBodyValue } from "../utils/emailBody.js";
import type { ResendContactPropertyMapping } from "../utils/resendContacts.js";
import type { EmailBroadcastResendSegmentConfig } from "../utils/recipientSegmentSync.js";
import {
  buildRecipientPreview,
  loadRecipientPreview,
  type RecipientPreviewCandidate,
  type RecipientPreviewResult,
} from "../utils/recipients.js";
import {
  getRelationshipId,
  resolveRecipientIdsFromGroups,
} from "../utils/sendCommon.js";

type CreateEmailBroadcastsCollectionArgs = {
  defaultFromEmail?: string;
  defaultFromName?: string;
  defaultReplyTo?: string;
  mediaCollection?: string;
  recipientsCollection: string;
  recipientEmailField: string;
  recipientFirstNameField?: string;
  recipientLastNameField?: string;
  resendApiKey: string;
  resendContactProperties?: ResendContactPropertyMapping[];
  resendSegments?: EmailBroadcastResendSegmentConfig[];
  siteUrl?: string;
  subscriptionField?: string;
};

export const createEmailBroadcastsCollection = ({
  defaultFromEmail,
  defaultFromName,
  defaultReplyTo,
  mediaCollection = "media",
  recipientsCollection,
  recipientEmailField,
  recipientFirstNameField,
  recipientLastNameField,
  resendApiKey,
  resendContactProperties,
  resendSegments = [],
  siteUrl,
  subscriptionField,
}: CreateEmailBroadcastsCollectionArgs): CollectionConfig => {
  const applyTemplateContent: CollectionBeforeValidateHook = async ({
    data,
    req,
  }) => {
    const typedData = data as Record<string, unknown>;
    const selectedTemplate = typedData.template;
    const shouldLoadTemplate =
      typedData.loadTemplateContent === true ||
      (
        selectedTemplate &&
        typeof typedData.subject !== "string" &&
        typeof typedData.body !== "string"
      );

    if (!selectedTemplate || !shouldLoadTemplate) {
      return typedData;
    }

    const templateId =
      typeof selectedTemplate === "string" || typeof selectedTemplate === "number"
        ? selectedTemplate
        : (
            selectedTemplate &&
            typeof selectedTemplate === "object" &&
            "id" in selectedTemplate &&
            (typeof selectedTemplate.id === "string" ||
              typeof selectedTemplate.id === "number")
          )
          ? selectedTemplate.id
          : null;

    if (!templateId) {
      return typedData;
    }

    const template = await req.payload.findByID({
      collection: "email-templates",
      id: templateId,
      depth: 0,
    });

    const typedTemplate = template as Record<string, unknown>;

    return {
      ...typedData,
      subject:
        typeof typedTemplate.subject === "string"
          ? typedTemplate.subject
          : typedData.subject,
      previewText:
        typeof typedTemplate.previewText === "string"
          ? typedTemplate.previewText
          : typedData.previewText,
      body:
        typedTemplate.body ?? typedData.body,
      type:
        typedTemplate.type === "marketing" || typedTemplate.type === "service"
          ? typedTemplate.type
          : typedData.type,
      loadTemplateContent: false,
    };
  };

  const normalizeLegacyBody: CollectionBeforeValidateHook = ({ data }) => {
    const typedData = (data ?? {}) as Record<string, unknown>;

    if (typeof typedData.body === "string") {
      return {
        ...typedData,
        body: normalizeEmailBodyValue(typedData.body),
      };
    }

    return typedData;
  };

  const normalizeLegacyBodyAfterRead: CollectionAfterReadHook = ({ doc }) => {
    const typedDoc = (doc ?? {}) as Record<string, unknown>;

    if (typeof typedDoc.body === "string") {
      return {
        ...typedDoc,
        body: normalizeEmailBodyValue(typedDoc.body),
      };
    }

    return typedDoc;
  };

  const populatePreviewSummary: CollectionBeforeChangeHook = async ({
    data,
    originalDoc,
    req,
  }) => {
    const typedData = data as Record<string, unknown>;
    const currentDoc = (originalDoc ?? {}) as Record<string, unknown>;
    const effectiveData = {
      ...currentDoc,
      ...typedData,
    };
    const recipientMode =
      effectiveData.recipientMode === "subscribed" ||
      effectiveData.recipientMode === "groups" ||
      effectiveData.recipientMode === "custom"
        ? effectiveData.recipientMode
        : "all";
    const broadcastType =
      effectiveData.type === "marketing" ? "marketing" : "service";

    let previewResult: RecipientPreviewResult;

    if (recipientMode === "custom" || recipientMode === "groups") {
      const recipientIds =
        recipientMode === "custom"
          ? (Array.isArray(effectiveData.customRecipients)
              ? effectiveData.customRecipients
              : [])
              .map(getRelationshipId)
              .filter((value): value is number | string => value !== null)
          : [];

      if (recipientMode === "groups") {
        const selectedGroups = Array.isArray(effectiveData.recipientGroups)
          ? effectiveData.recipientGroups
          : [];
        recipientIds.push(
          ...(await resolveRecipientIdsFromGroups({
            payload: req.payload,
            selectedGroups,
          })),
        );
      }

      if (recipientIds.length === 0) {
        previewResult = buildRecipientPreview({
          candidates: [],
          type: broadcastType,
          subscriptionField,
        });
      } else {
        const result = await req.payload.find({
          collection: recipientsCollection,
          depth: 0,
          limit: recipientIds.length,
          pagination: false,
          where: {
            id: {
              in: recipientIds,
            },
          },
        });

        const candidates: RecipientPreviewCandidate[] = result.docs.map((doc) => {
          const typedDoc = doc as Record<string, unknown>;

          return {
            id:
              typeof typedDoc.id === "number" || typeof typedDoc.id === "string"
                ? typedDoc.id
                : undefined,
            email: typedDoc[recipientEmailField],
            newsletterSubscribed: subscriptionField
              ? typedDoc[subscriptionField]
              : undefined,
          };
        });

        previewResult = buildRecipientPreview({
          candidates,
          type: broadcastType,
          subscriptionField,
        });
      }
    } else {
      previewResult = await loadRecipientPreview({
        payload: req.payload,
        collection: recipientsCollection,
        emailField: recipientEmailField,
        type: recipientMode === "subscribed" ? "marketing" : broadcastType,
        subscriptionField,
      });
    }

    return {
      ...typedData,
      previewTotalCandidateRecipients:
        previewResult.totalCandidateRecipients,
      previewRecipientsWithoutEmail:
        previewResult.recipientsWithoutEmail,
      previewDuplicateEmails: previewResult.duplicateEmails,
      previewUnsubscribedRecipients:
        previewResult.unsubscribedRecipients,
      recipientCount: previewResult.finalRecipients,
    };
  };

  return {
    slug: "email-broadcasts",
    labels: {
      singular: "Имейл кампания",
      plural: "Имейл кампании",
    },
    admin: {
      useAsTitle: "title",
      group: "Кампании",
      description:
        "Тук се съхраняват имейл кампаниите и данните за изпращането им.",
    },
    endpoints: [
      {
        path: "/:id/create-broadcast-draft",
        method: "post",
        handler: createBroadcastDraftEndpoint({
          defaultFromEmail,
          defaultFromName,
          defaultReplyTo,
          recipientEmailField,
          recipientFirstNameField,
          recipientLastNameField,
          recipientsCollection,
          resendApiKey,
          siteUrl,
          subscriptionField,
        }).handler,
      },
      {
        path: "/:id/send-resend-broadcast",
        method: "post",
        handler: createSendResendBroadcastEndpoint({
          resendApiKey,
        }).handler,
      },
      {
        path: "/:id/send-summary",
        method: "get",
        handler: createSendSummaryEndpoint({
          recipientEmailField,
          recipientFirstNameField,
          recipientLastNameField,
          recipientsCollection,
          subscriptionField,
        }).handler,
      },
      {
        path: "/:id/sync-audience",
        method: "post",
        handler: createSyncAudienceEndpoint({
          recipientEmailField,
          recipientFirstNameField,
          recipientLastNameField,
          recipientsCollection,
          resendApiKey,
          resendContactProperties,
          resendSegments,
          subscriptionField,
        }).handler,
      },
      {
        path: "/:id/send-test",
        method: "post",
        handler: createSendTestEndpoint({
          defaultFromEmail,
          defaultFromName,
          defaultReplyTo,
          recipientEmailField,
          recipientFirstNameField,
          recipientLastNameField,
          recipientsCollection,
          resendApiKey,
          siteUrl,
          subscriptionField,
        }).handler,
      },
    ],
    hooks: {
      afterRead: [normalizeLegacyBodyAfterRead],
      beforeValidate: [normalizeLegacyBody, applyTemplateContent],
      beforeChange: [populatePreviewSummary],
    },
    fields: [
      { name: "title", label: "Заглавие", type: "text", required: true },
      {
        name: "template",
        label: "Шаблон",
        type: "relationship",
        relationTo: "email-templates",
      },
      {
        name: "loadTemplateContent",
        label: "Зареди съдържанието от шаблона",
        type: "checkbox",
        defaultValue: false,
        admin: {
          condition: (_, siblingData) => Boolean(siblingData?.template),
          description:
            "При записване ще копира темата, прегледния текст, съдържанието и типа от избрания шаблон.",
        },
      },
      { name: "subject", label: "Тема", type: "text", required: true },
      { name: "previewText", label: "Прегледен текст", type: "text" },
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
        name: "status",
        label: "Статус",
        type: "select",
        required: true,
        defaultValue: "draft",
        options: [
          { label: "Чернова", value: "draft" },
          { label: "Готова", value: "ready" },
          { label: "Подготвя се", value: "preparing" },
          { label: "Синхронизирана в Resend", value: "synced" },
          { label: "Насрочена", value: "scheduled" },
          { label: "Изпратена", value: "sent" },
          { label: "Неуспешна", value: "failed" },
        ],
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
      {
        name: "recipientMode",
        label: "Режим на получателите",
        type: "select",
        required: true,
        defaultValue: "all",
        options: [
          { label: "Всички", value: "all" },
          { label: "Абонирани", value: "subscribed" },
          { label: "Групи", value: "groups" },
          { label: "Ръчно избрани", value: "custom" },
        ],
        admin: {
          description:
            "Избери дали да се изпрати до всички, само до абонираните, до групи или до ръчно избрани получатели.",
        },
      },
      {
        name: "recipientGroups",
        label: "Групи получатели",
        type: "relationship",
        relationTo: "email-recipient-groups",
        hasMany: true,
        admin: {
          condition: (_, siblingData) => siblingData?.recipientMode === "groups",
          description:
            "Избери една или повече групи. Дублираните имейли ще бъдат премахнати автоматично.",
        },
      },
      {
        name: "customRecipients",
        label: "Ръчно избрани получатели",
        type: "relationship",
        relationTo: recipientsCollection,
        hasMany: true,
        admin: {
          condition: (_, siblingData) => siblingData?.recipientMode === "custom",
          description:
            "Избери точните получатели, ако кампанията е в ръчен режим.",
        },
      },
      {
        name: "resendSegmentKey",
        label: "Resend сегмент",
        type: "select",
        required: resendSegments.length > 0,
        options: resendSegments.map((segment) => ({
          label: segment.label,
          value: segment.key,
        })),
        admin: {
          condition: () => resendSegments.length > 0,
          description:
            "Избери постоянния Resend сегмент, към който ще бъде изпратена тази кампания.",
        },
      },
      {
        name: "previewTotalCandidateRecipients",
        label: "Общо разгледани",
        type: "number",
        defaultValue: 0,
        admin: {
          readOnly: true,
          description: "Колко записа са били разгледани преди филтриране.",
        },
      },
      {
        name: "previewRecipientsWithoutEmail",
        label: "Без имейл",
        type: "number",
        defaultValue: 0,
        admin: {
          readOnly: true,
          description: "Колко записа са пропуснати, защото нямат имейл.",
        },
      },
      {
        name: "previewDuplicateEmails",
        label: "Дублирани имейли",
        type: "number",
        defaultValue: 0,
        admin: {
          readOnly: true,
          description: "Колко записа са пропуснати, защото имейлът се повтаря.",
        },
      },
      {
        name: "previewUnsubscribedRecipients",
        label: "Отписани",
        type: "number",
        defaultValue: 0,
        admin: {
          readOnly: true,
          description:
            "Колко получатели са пропуснати, защото са отписани.",
        },
      },
      { name: "sentAt", label: "Изпратена на", type: "date" },
      {
        name: "recipientCount",
        label: "Крайни получатели",
        type: "number",
        defaultValue: 0,
        admin: { readOnly: true },
      },
      {
        name: "skippedCount",
        label: "Пропуснати",
        type: "number",
        defaultValue: 0,
        admin: {
          readOnly: true,
          description:
            "Колко получатели са пропуснати при подготовката или sync-а.",
        },
      },
      {
        name: "syncedCount",
        label: "Синхронизирани в Resend",
        type: "number",
        defaultValue: 0,
        admin: {
          readOnly: true,
          description:
            "Колко получатели са синхронизирани като Resend Contacts.",
        },
      },
      {
        name: "syncFailedCount",
        label: "Неуспешни sync записи",
        type: "number",
        defaultValue: 0,
        admin: {
          readOnly: true,
          description:
            "Колко получатели не са синхронизирани успешно към Resend.",
        },
      },
      {
        name: "resendSegmentId",
        label: "Resend Segment ID",
        type: "text",
        admin: {
          readOnly: true,
          description:
            "Segment-ът в Resend, към който ще бъде вързан Broadcast-ът.",
        },
      },
      {
        name: "resendBroadcastId",
        label: "Resend Broadcast ID",
        type: "text",
        admin: {
          readOnly: true,
          description:
            "Broadcast-ът в Resend, създаден от тази Payload кампания.",
        },
      },
      {
        name: "resendBroadcastStatus",
        label: "Resend Broadcast статус",
        type: "text",
        admin: {
          readOnly: true,
          description:
            "Статусът, върнат от Resend за свързания Broadcast.",
        },
      },
      {
        name: "resendLastSyncedAt",
        label: "Последен Resend sync на",
        type: "date",
        admin: {
          readOnly: true,
        },
      },
      {
        name: "resendLastError",
        label: "Последна Resend грешка",
        type: "textarea",
        admin: {
          readOnly: true,
        },
      },
      {
        name: "lastTestEmailSentAt",
        label: "Последен тест на",
        type: "date",
        admin: {
          readOnly: true,
          description: "Попълва се след успешно тестово изпращане.",
        },
      },
      {
        name: "lastTestEmailSentTo",
        label: "Последен тест до",
        type: "text",
        admin: {
          readOnly: true,
        },
      },
      {
        name: "lastTestProviderMessageId",
        label: "ID на тестовото изпращане",
        type: "text",
        admin: {
          readOnly: true,
        },
      },
      {
        name: "lastTestEmailError",
        label: "Последна тестова грешка",
        type: "textarea",
        admin: {
          readOnly: true,
        },
      },
      {
        name: "sendControls",
        label: "Изпращане",
        type: "ui",
        admin: {
          components: {
            Field:
              "payload-email-broadcast-plugin/dist/client/SendTestButton.js#SendTestButton",
          },
        },
      },
    ],
  };
};
