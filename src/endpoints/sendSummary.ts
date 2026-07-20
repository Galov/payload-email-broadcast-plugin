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
import type { EmailBroadcastResendSegmentConfig } from "../utils/recipientSegmentSync.js";

type CreateSendSummaryEndpointArgs = SendCommonConfig & {
  resendSegments?: EmailBroadcastResendSegmentConfig[];
};

export const createSendSummaryEndpoint = ({
  recipientEmailField,
  recipientFirstNameField,
  recipientLastNameField,
  recipientSegmentsFieldName,
  recipientsCollection,
  resendSegments = [],
  subscriptionField,
}: CreateSendSummaryEndpointArgs): Endpoint => {
  const config: SendCommonConfig = {
    recipientEmailField,
    recipientFirstNameField,
    recipientLastNameField,
    recipientSegmentsFieldName,
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

      const selectedSegmentKey = asNonEmptyString(broadcast.resendSegmentKey);
      const selectedSegment = resendSegments.find(
        (segment) => segment.key === selectedSegmentKey,
      );

      const candidates = await resolveCandidateDocs({
        broadcast,
        config,
        payload: req.payload,
      });
      const summary: RecipientPreviewSummary = buildRecipientPreview({
        candidates,
        subscriptionField,
        type: "marketing",
      });

      return Response.json({
        allowed: selectedSegment !== undefined,
        campaign: {
          hasPreparedEmail: asNonEmptyString(broadcast.resendBroadcastId) !== null,
          hasPreparedRecipients: asNonEmptyString(broadcast.resendSegmentId) !== null,
          isSent: broadcast.status === "sent" || broadcast.resendBroadcastStatus === "sent",
          status: typeof broadcast.status === "string" ? broadcast.status : null,
        },
        segmentKey: selectedSegmentKey,
        segmentLabel: selectedSegment?.label ?? null,
        summary,
      });
    },
  };
};
