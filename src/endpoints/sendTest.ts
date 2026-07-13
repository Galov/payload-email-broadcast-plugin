import { canAccessAdmin, type Endpoint, type Payload } from "payload";
import {
  buildRecipientPreview,
  type RecipientPreviewCandidate,
  type RecipientPreviewType,
} from "../utils/recipients.js";
import {
  renderEmailBodyHTML,
  renderEmailLayoutHTML,
} from "../utils/emailBody.js";
import { renderTemplate } from "../utils/renderTemplate.js";
import { sendWithResend } from "../providers/resend.js";
import { resolveBroadcastTemplate } from "../utils/sendCommon.js";

type CreateSendTestEndpointArgs = {
  defaultFromEmail?: string;
  defaultFromName?: string;
  defaultReplyTo?: string;
  recipientEmailField: string;
  recipientFirstNameField?: string;
  recipientLastNameField?: string;
  recipientsCollection: string;
  resendApiKey: string;
  subscriptionField?: string;
};

type CandidateDoc = RecipientPreviewCandidate & Record<string, unknown>;

const asNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  return normalized.length > 0 ? normalized : null;
};

const stripHtml = (value: string): string => {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/(p|div|br|li|h1|h2|h3|h4|h5|h6)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
};

const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const buildFromAddress = ({
  defaultFromEmail,
  defaultFromName,
  settings,
}: {
  defaultFromEmail?: string;
  defaultFromName?: string;
  settings: Record<string, unknown>;
}): string | null => {
  const fromEmail =
    asNonEmptyString(settings.defaultFromEmail) ?? defaultFromEmail ?? null;
  const fromName =
    asNonEmptyString(settings.defaultFromName) ?? defaultFromName ?? null;

  if (!fromEmail) {
    return null;
  }

  return fromName ? `${fromName} <${fromEmail}>` : fromEmail;
};

const resolveCandidateDocs = async ({
  broadcast,
  payload,
  recipientEmailField,
  recipientFirstNameField,
  recipientLastNameField,
  recipientsCollection,
  subscriptionField,
}: {
  broadcast: Record<string, unknown>;
  payload: Payload;
  recipientEmailField: string;
  recipientFirstNameField?: string;
  recipientLastNameField?: string;
  recipientsCollection: string;
  subscriptionField?: string;
}): Promise<CandidateDoc[]> => {
  const customRecipients = Array.isArray(broadcast.customRecipients)
    ? broadcast.customRecipients
    : [];

  if (broadcast.recipientMode === "custom") {
    const recipientIds = customRecipients
      .map((value) => {
        if (typeof value === "string" || typeof value === "number") {
          return value;
        }

        if (
          value &&
          typeof value === "object" &&
          "id" in value &&
          (typeof value.id === "string" || typeof value.id === "number")
        ) {
          return value.id;
        }

        return null;
      })
      .filter((value): value is number | string => value !== null);

    if (recipientIds.length === 0) {
      return [];
    }

    const result = await payload.find({
      collection: recipientsCollection,
      depth: 0,
      limit: recipientIds.length,
      overrideAccess: true,
      pagination: false,
      where: {
        id: {
          in: recipientIds,
        },
      },
    });

    return result.docs.map((doc) => {
      const typedDoc = doc as Record<string, unknown>;

      return {
        email: typedDoc[recipientEmailField],
        id:
          typeof typedDoc.id === "number" || typeof typedDoc.id === "string"
            ? typedDoc.id
            : undefined,
        ...(recipientFirstNameField
          ? { [recipientFirstNameField]: typedDoc[recipientFirstNameField] }
          : {}),
        ...(recipientLastNameField
          ? { [recipientLastNameField]: typedDoc[recipientLastNameField] }
          : {}),
        ...(subscriptionField
          ? { newsletterSubscribed: typedDoc[subscriptionField] }
          : {}),
      };
    });
  }

  const result = await payload.find({
    collection: recipientsCollection,
    depth: 0,
    limit: 100,
    overrideAccess: true,
    pagination: false,
  });

  return result.docs.map((doc) => {
    const typedDoc = doc as Record<string, unknown>;

    return {
      email: typedDoc[recipientEmailField],
      id:
        typeof typedDoc.id === "number" || typeof typedDoc.id === "string"
          ? typedDoc.id
          : undefined,
      ...(recipientFirstNameField
        ? { [recipientFirstNameField]: typedDoc[recipientFirstNameField] }
        : {}),
      ...(recipientLastNameField
        ? { [recipientLastNameField]: typedDoc[recipientLastNameField] }
        : {}),
      ...(subscriptionField
        ? { newsletterSubscribed: typedDoc[subscriptionField] }
        : {}),
    };
  });
};

const resolveRenderData = ({
  broadcast,
  candidates,
  recipientEmailField,
  recipientFirstNameField,
  recipientLastNameField,
  subscriptionField,
  testRecipientEmail,
}: {
  broadcast: Record<string, unknown>;
  candidates: CandidateDoc[];
  recipientEmailField: string;
  recipientFirstNameField?: string;
  recipientLastNameField?: string;
  subscriptionField?: string;
  testRecipientEmail: string;
}) => {
  const previewType: RecipientPreviewType =
    broadcast.recipientMode === "subscribed"
      ? "marketing"
      : broadcast.type === "marketing"
        ? "marketing"
        : "service";

  const preview = buildRecipientPreview({
    candidates,
    subscriptionField,
    type: previewType,
  });

  const sampleRecipient = preview.acceptedRecipients[0];
  const sampleDoc = candidates.find((candidate) => candidate.id === sampleRecipient?.id);

  return {
    email: sampleRecipient?.email ?? testRecipientEmail,
    firstName:
      (recipientFirstNameField
        ? asNonEmptyString(
            sampleDoc?.[recipientFirstNameField as keyof CandidateDoc],
          )
        : null) ??
      "Тест",
    lastName:
      (recipientLastNameField
        ? asNonEmptyString(
            sampleDoc?.[recipientLastNameField as keyof CandidateDoc],
          )
        : null) ??
      "Получател",
    unsubscribeUrl: "https://example.com/unsubscribe",
  };
};

export const createSendTestEndpoint = ({
  defaultFromEmail,
  defaultFromName,
  defaultReplyTo,
  recipientEmailField,
  recipientFirstNameField,
  recipientLastNameField,
  recipientsCollection,
  resendApiKey,
  subscriptionField,
}: CreateSendTestEndpointArgs): Endpoint => {
  return {
    method: "post",
    path: "/:id/send-test",
    handler: async (req) => {
      try {
        await canAccessAdmin({ req });
      } catch {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      const broadcastId =
        typeof req.routeParams?.id === "string" || typeof req.routeParams?.id === "number"
          ? String(req.routeParams.id)
          : null;

      if (!broadcastId) {
        return Response.json({ error: "Missing broadcast id" }, { status: 400 });
      }

      const broadcast = (await req.payload.findByID({
        collection: "email-broadcasts",
        id: broadcastId,
        depth: 0,
        overrideAccess: true,
      })) as Record<string, unknown>;

      const settings = (await req.payload.findGlobal({
        slug: "email-settings",
        depth: 0,
        overrideAccess: true,
      })) as Record<string, unknown>;

      const testRecipientEmail = asNonEmptyString(settings.testRecipientEmail);

      if (!testRecipientEmail) {
        return Response.json(
          { error: "Missing test recipient email in Email Settings" },
          { status: 400 },
        );
      }

      const from = buildFromAddress({
        defaultFromEmail,
        defaultFromName,
        settings,
      });

      if (!from) {
        return Response.json(
          { error: "Missing sender email in Email Settings or plugin config" },
          { status: 400 },
        );
      }

      const replyTo =
        asNonEmptyString(settings.defaultReplyTo) ?? defaultReplyTo ?? undefined;

      const candidates = await resolveCandidateDocs({
        broadcast,
        payload: req.payload,
        recipientEmailField,
        recipientFirstNameField,
        recipientLastNameField,
        recipientsCollection,
        subscriptionField,
      });
      const renderData = resolveRenderData({
        broadcast,
        candidates,
        recipientEmailField,
        recipientFirstNameField,
        recipientLastNameField,
        subscriptionField,
        testRecipientEmail,
      });

      const renderedSubject = renderTemplate(
        asNonEmptyString(broadcast.subject) ?? "Тестов имейл",
        renderData,
      );
      const renderedPreviewText = renderTemplate(
        asNonEmptyString(broadcast.previewText) ?? "",
        renderData,
      );
      const renderedBody = await renderEmailBodyHTML({
        data: renderData,
        req,
        value: broadcast.body,
      });
      const footerText = asNonEmptyString(settings.footerText);
      const template = await resolveBroadcastTemplate({
        broadcast,
        payload: req.payload,
      });
      const html = await renderEmailLayoutHTML({
        bodyHtml: renderedBody,
        data: renderData,
        previewText: renderedPreviewText,
        req,
        settingsFooterText: footerText,
        template,
        testNotice: "Той е изпратен само до конфигурирания тестов адрес.",
      });

      const text = [
        "Тестов имейл. Той е изпратен само до конфигурирания тестов адрес.",
        renderedPreviewText,
        stripHtml(renderedBody),
        footerText,
      ]
        .filter((value) => typeof value === "string" && value.trim().length > 0)
        .join("\n\n");

      try {
        const result = await sendWithResend({
          apiKey: resendApiKey,
          from,
          html,
          replyTo,
          subject: renderedSubject,
          text,
          to: testRecipientEmail,
        });

        await req.payload.update({
          collection: "email-broadcasts",
          id: broadcastId,
          data: {
            lastTestEmailError: null,
            lastTestEmailSentAt: new Date().toISOString(),
            lastTestEmailSentTo: testRecipientEmail,
            lastTestProviderMessageId: result.providerMessageId,
          },
          overrideAccess: true,
        });

        return Response.json({
          ok: true,
          providerMessageId: result.providerMessageId,
          testRecipientEmail,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        await req.payload.update({
          collection: "email-broadcasts",
          id: broadcastId,
          data: {
            lastTestEmailError: errorMessage,
            lastTestEmailSentTo: testRecipientEmail,
          },
          overrideAccess: true,
        });

        return Response.json({ error: errorMessage }, { status: 500 });
      }
    },
  };
};
