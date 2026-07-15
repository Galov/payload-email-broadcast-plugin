import { canAccessAdmin, type Endpoint } from "payload";
import {
  renderEmailBodyHTML,
  renderEmailLayoutHTML,
} from "../utils/emailBody.js";
import { renderTemplate } from "../utils/renderTemplate.js";
import {
  asNonEmptyString,
  buildAcceptedRecipients,
  buildFromAddress,
  resolveBroadcastTemplate,
  resolveCandidateDocs,
  resolveRenderData,
  stripHtml,
  type SendCommonConfig,
} from "../utils/sendCommon.js";
import { sendWithResend } from "../providers/resend.js";

type CreateSendBroadcastEndpointArgs = SendCommonConfig & {
  defaultFromEmail?: string;
  defaultFromName?: string;
  defaultReplyTo?: string;
  resendApiKey: string;
  siteUrl?: string;
};

const MAX_CONTROLLED_RECIPIENTS = 10;

export const createSendBroadcastEndpoint = ({
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
}: CreateSendBroadcastEndpointArgs): Endpoint => {
  const config: SendCommonConfig = {
    recipientEmailField,
    recipientFirstNameField,
    recipientLastNameField,
    recipientsCollection,
    subscriptionField,
  };

  return {
    method: "post",
    path: "/:id/send-broadcast",
    handler: async (req) => {
      try {
        await canAccessAdmin({ req });
      } catch {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      const body = (await req.json?.().catch(() => null)) as {
        confirmation?: unknown;
      } | null;

      if (body?.confirmation !== "ИЗПРАТИ") {
        return Response.json(
          { error: "Липсва потвърждение за реално изпращане." },
          { status: 400 },
        );
      }

      const broadcastId =
        typeof req.routeParams?.id === "string" || typeof req.routeParams?.id === "number"
          ? String(req.routeParams.id)
          : null;

      if (!broadcastId) {
        return Response.json({ error: "Липсва ID на кампанията." }, { status: 400 });
      }

      const broadcast = (await req.payload.findByID({
        collection: "email-broadcasts",
        id: broadcastId,
        depth: 0,
        overrideAccess: true,
      })) as Record<string, unknown>;

      if (
        broadcast.recipientMode !== "custom" &&
        broadcast.recipientMode !== "groups" &&
        broadcast.recipientMode !== "all"
      ) {
        return Response.json(
          {
            error:
              "Първо запази кампанията с режим \"Ръчно избрани\", \"Групи\" или \"Всички\". Реалното изпращане използва записаните данни от базата.",
          },
          { status: 400 },
        );
      }

      if (broadcast.status === "sending" || broadcast.status === "sent") {
        return Response.json(
          { error: "Тази кампания вече се изпраща или вече е изпратена." },
          { status: 400 },
        );
      }

      const settings = (await req.payload.findGlobal({
        slug: "email-settings",
        depth: 0,
        overrideAccess: true,
      })) as Record<string, unknown>;

      const from = buildFromAddress({
        defaultFromEmail,
        defaultFromName,
        settings,
      });

      if (!from) {
        return Response.json(
          { error: "Липсва имейл на изпращача в Имейл настройки или plugin config." },
          { status: 400 },
        );
      }

      const candidates = await resolveCandidateDocs({
        broadcast,
        config,
        payload: req.payload,
      });
      const recipients = buildAcceptedRecipients({
        broadcast,
        candidates,
        subscriptionField,
      });

      if (recipients.length === 0) {
        return Response.json(
          { error: "Няма валидни избрани получатели." },
          { status: 400 },
        );
      }

      if (recipients.length > MAX_CONTROLLED_RECIPIENTS) {
        return Response.json(
          {
            error: `Контролираното изпращане засега е ограничено до ${MAX_CONTROLLED_RECIPIENTS} получатели. Провери брояча "Крайни получатели" преди изпращане.`,
          },
          { status: 400 },
        );
      }

      await req.payload.update({
        collection: "email-broadcasts",
        id: broadcastId,
        data: {
          deliveredCount: 0,
          failedCount: 0,
          status: "sending",
        },
        overrideAccess: true,
      });

      const replyTo =
        asNonEmptyString(settings.defaultReplyTo) ?? defaultReplyTo ?? undefined;
      const footerText = asNonEmptyString(settings.footerText);
      const template = await resolveBroadcastTemplate({
        broadcast,
        payload: req.payload,
      });
      const sentAt = new Date().toISOString();
      let deliveredCount = 0;
      let failedCount = 0;

      for (const recipient of recipients) {
        const candidate = candidates.find((item) => item.id === recipient.id);
        const renderData = resolveRenderData({
          candidate,
          config,
          email: recipient.email,
          unsubscribeUrl: "https://example.com/unsubscribe",
        });
        const subject = renderTemplate(
          asNonEmptyString(broadcast.subject) ?? "Имейл кампания",
          renderData,
        );
        const previewText = renderTemplate(
          asNonEmptyString(broadcast.previewText) ?? "",
          renderData,
        );
        const bodyHtml = await renderEmailBodyHTML({
          data: renderData,
          req,
          siteUrl,
          value: broadcast.body,
        });
        const html = await renderEmailLayoutHTML({
          bodyHtml,
          data: renderData,
          previewText,
          req,
          settingsFooterText: footerText,
          siteUrl,
          template,
        });
        const text = [previewText, stripHtml(bodyHtml), footerText]
          .filter((value) => typeof value === "string" && value.trim().length > 0)
          .join("\n\n");

        try {
          const result = await sendWithResend({
            apiKey: resendApiKey,
            from,
            html,
            replyTo,
            subject,
            text,
            to: recipient.email,
          });

          deliveredCount += 1;

          await req.payload.create({
            collection: "email-logs",
            data: {
              broadcast: broadcastId,
              email: recipient.email,
              providerMessageId: result.providerMessageId,
              recipientId: recipient.id ? String(recipient.id) : undefined,
              sentAt,
              status: "sent",
            },
            overrideAccess: true,
          });
        } catch (error) {
          failedCount += 1;

          await req.payload.create({
            collection: "email-logs",
            data: {
              broadcast: broadcastId,
              email: recipient.email,
              error: error instanceof Error ? error.message : "Unknown error",
              recipientId: recipient.id ? String(recipient.id) : undefined,
              sentAt,
              status: "failed",
            },
            overrideAccess: true,
          });
        }
      }

      await req.payload.update({
        collection: "email-broadcasts",
        id: broadcastId,
        data: {
          deliveredCount,
          failedCount,
          sentAt,
          status: failedCount > 0 ? "failed" : "sent",
        },
        overrideAccess: true,
      });

      return Response.json({
        deliveredCount,
        failedCount,
        ok: failedCount === 0,
        recipientCount: recipients.length,
      });
    },
  };
};
