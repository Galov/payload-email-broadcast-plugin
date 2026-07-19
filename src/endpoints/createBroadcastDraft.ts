import { canAccessAdmin, type Endpoint } from "payload";
import { createResendBroadcast } from "../providers/resend.js";
import { renderResendBroadcastContent } from "../utils/resendBroadcast.js";
import {
  asNonEmptyString,
  buildFromAddress,
  type SendCommonConfig,
} from "../utils/sendCommon.js";

type CreateBroadcastDraftEndpointArgs = SendCommonConfig & {
  defaultFromEmail?: string;
  defaultFromName?: string;
  defaultReplyTo?: string;
  resendApiKey: string;
  siteUrl?: string;
};

export const createBroadcastDraftEndpoint = ({
  defaultFromEmail,
  defaultFromName,
  defaultReplyTo,
  resendApiKey,
  siteUrl,
}: CreateBroadcastDraftEndpointArgs): Endpoint => {
  return {
    method: "post",
    path: "/:id/create-broadcast-draft",
    handler: async (req) => {
      try {
        await canAccessAdmin({ req });
      } catch {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      const broadcastId =
        typeof req.routeParams?.id === "string" ||
        typeof req.routeParams?.id === "number"
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
      const existingBroadcastId = asNonEmptyString(broadcast.resendBroadcastId);

      if (existingBroadcastId) {
        return Response.json(
          {
            error:
              "Тази кампания вече има създадена чернова, готова за изпращане.",
            resendBroadcastId: existingBroadcastId,
          },
          { status: 400 },
        );
      }

      const segmentId = asNonEmptyString(broadcast.resendSegmentId);

      if (!segmentId) {
        return Response.json(
          {
            error:
              "Първо синхронизирай получателите към Resend Segment.",
          },
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

      try {
        const content = await renderResendBroadcastContent({
          broadcast,
          req,
          settings,
          siteUrl,
        });
        const result = await createResendBroadcast({
          apiKey: resendApiKey,
          from,
          html: content.html,
          name: asNonEmptyString(broadcast.title) ?? `Payload campaign ${broadcastId}`,
          previewText: content.previewText,
          replyTo:
            asNonEmptyString(settings.defaultReplyTo) ??
            defaultReplyTo ??
            undefined,
          segmentId,
          send: false,
          subject: content.subject,
          text: content.text,
        });

        await req.payload.update({
          collection: "email-broadcasts",
          id: broadcastId,
          data: {
            resendBroadcastId: result.broadcastId,
            resendBroadcastStatus: "draft",
            resendLastError: null,
            status: "ready",
          },
          overrideAccess: true,
        });

        return Response.json({
          ok: true,
          resendBroadcastId: result.broadcastId,
          resendBroadcastStatus: "draft",
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        await req.payload.update({
          collection: "email-broadcasts",
          id: broadcastId,
          data: {
            resendLastError: errorMessage,
          },
          overrideAccess: true,
        });

        return Response.json({ error: errorMessage }, { status: 500 });
      }
    },
  };
};
