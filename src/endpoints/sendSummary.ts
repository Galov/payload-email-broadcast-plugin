import { canAccessAdmin, type Endpoint } from "payload";
import {
  buildRecipientPreview,
  type RecipientPreviewSummary,
} from "../utils/recipients.js";
import {
  asNonEmptyString,
  resolveCandidateDocs,
  type SendCommonConfig,
} from "../utils/sendCommon.js";

type CreateSendSummaryEndpointArgs = SendCommonConfig & {
};

const getRecipientModeLabel = (value: unknown) => {
  if (value === "custom") {
    return "Ръчно избрани";
  }

  if (value === "groups") {
    return "Групи";
  }

  if (value === "subscribed") {
    return "Абонирани";
  }

  return "Всички";
};

export const createSendSummaryEndpoint = ({
  recipientEmailField,
  recipientFirstNameField,
  recipientLastNameField,
  recipientsCollection,
  subscriptionField,
}: CreateSendSummaryEndpointArgs): Endpoint => {
  const config: SendCommonConfig = {
    recipientEmailField,
    recipientFirstNameField,
    recipientLastNameField,
    recipientsCollection,
    subscriptionField,
  };

  return {
    method: "get",
    path: "/:id/send-summary",
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

      const isAllowedMode =
        broadcast.recipientMode === "custom" ||
        broadcast.recipientMode === "groups" ||
        broadcast.recipientMode === "all";

      const candidates = await resolveCandidateDocs({
        broadcast,
        config,
        payload: req.payload,
      });
      const summary: RecipientPreviewSummary = buildRecipientPreview({
        candidates,
        subscriptionField,
        type: broadcast.type === "marketing" ? "marketing" : "service",
      });

      return Response.json({
        allowed: isAllowedMode,
        campaign: {
          hasPreparedEmail: asNonEmptyString(broadcast.resendBroadcastId) !== null,
          hasPreparedRecipients: asNonEmptyString(broadcast.resendSegmentId) !== null,
          isSent: broadcast.status === "sent" || broadcast.resendBroadcastStatus === "sent",
          status: typeof broadcast.status === "string" ? broadcast.status : null,
        },
        mode: broadcast.recipientMode ?? "all",
        modeLabel: getRecipientModeLabel(broadcast.recipientMode),
        summary,
      });
    },
  };
};
