import { canAccessAdmin, type Endpoint } from "payload";
import { buildRecipientPreview } from "../utils/recipients.js";
import {
  renderEmailBodyHTML,
  renderEmailLayoutHTML,
} from "../utils/emailBody.js";
import { renderTemplate } from "../utils/renderTemplate.js";
import { sendWithResend } from "../providers/resend.js";
import {
  asNonEmptyString,
  buildFromAddress,
  escapeHtml,
  resolveBroadcastTemplate,
  resolveCandidateDocs,
  stripHtml,
  type CandidateDoc,
  type SendCommonConfig,
} from "../utils/sendCommon.js";

type CreateSendTestEndpointArgs = {
  defaultFromEmail?: string;
  defaultFromName?: string;
  defaultReplyTo?: string;
  recipientEmailField: string;
  recipientFirstNameField?: string;
  recipientLastNameField?: string;
  recipientSegmentsFieldName?: string;
  recipientsCollection: string;
  resendApiKey: string;
  siteUrl?: string;
  subscriptionField?: string;
};

const resolveRenderData = ({
  candidates,
  recipientFirstNameField,
  recipientLastNameField,
  subscriptionField,
  testRecipientEmail,
}: {
  candidates: CandidateDoc[];
  recipientFirstNameField?: string;
  recipientLastNameField?: string;
  subscriptionField?: string;
  testRecipientEmail: string;
}) => {
  const preview = buildRecipientPreview({
    candidates,
    subscriptionField,
    type: "marketing",
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
  recipientSegmentsFieldName,
  recipientsCollection,
  resendApiKey,
  siteUrl,
  subscriptionField,
}: CreateSendTestEndpointArgs): Endpoint => {
  const config: SendCommonConfig = {
    recipientEmailField,
    recipientFirstNameField,
    recipientLastNameField,
    recipientSegmentsFieldName,
    recipientsCollection,
    subscriptionField,
  };

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
        config,
        payload: req.payload,
      });
      const renderData = resolveRenderData({
        candidates,
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
        siteUrl,
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
        siteUrl,
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
