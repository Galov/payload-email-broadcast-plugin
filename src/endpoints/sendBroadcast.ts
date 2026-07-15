import { canAccessAdmin, type Endpoint } from "payload";
import {
  buildFromAddress,
  type SendCommonConfig,
} from "../utils/sendCommon.js";
import { queuePrepareEmailBroadcastJob } from "../utils/broadcastSending.js";

type CreateSendBroadcastEndpointArgs = SendCommonConfig & {
  defaultFromEmail?: string;
  defaultFromName?: string;
  defaultReplyTo?: string;
  dryRun?: boolean;
  resendApiKey: string;
  siteUrl?: string;
};

export const createSendBroadcastEndpoint = ({
  defaultFromEmail,
  defaultFromName,
  dryRun,
}: CreateSendBroadcastEndpointArgs): Endpoint => {
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

      if (
        broadcast.status === "queued" ||
        broadcast.status === "sending" ||
        broadcast.status === "sent"
      ) {
        return Response.json(
          { error: "Тази кампания вече е в опашката, изпраща се или вече е изпратена." },
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

      await req.payload.update({
        collection: "email-broadcasts",
        id: broadcastId,
        data: {
          deliveredCount: 0,
          failedCount: 0,
          sentAt: null,
          status: "queued",
        },
        overrideAccess: true,
      });

      await queuePrepareEmailBroadcastJob({
        broadcastId,
        payload: req.payload,
      });

      return Response.json({
        dryRun: dryRun === true,
        ok: true,
        queued: true,
      });
    },
  };
};
