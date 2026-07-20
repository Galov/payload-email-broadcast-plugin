import { canAccessAdmin, type Endpoint } from "payload";
import { buildResendContactSyncPlan } from "../utils/resendContacts.js";
import {
  asNonEmptyString,
  resolveCandidateDocs,
  type SendCommonConfig,
} from "../utils/sendCommon.js";
import type { ResendContactPropertyMapping } from "../utils/resendContacts.js";
import type { EmailBroadcastResendSegmentConfig } from "../utils/recipientSegmentSync.js";

type CreateSyncAudienceEndpointArgs = SendCommonConfig & {
  resendApiKey: string;
  resendContactProperties?: ResendContactPropertyMapping[];
  resendSegments?: EmailBroadcastResendSegmentConfig[];
};

export const createSyncAudienceEndpoint = ({
  recipientEmailField,
  recipientFirstNameField,
  recipientLastNameField,
  recipientSegmentsFieldName,
  recipientsCollection,
  resendContactProperties,
  resendSegments = [],
  subscriptionField,
}: CreateSyncAudienceEndpointArgs): Endpoint => {
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
    path: "/:id/sync-audience",
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

      const body = (await req.json?.().catch(() => null)) as {
        confirmation?: unknown;
      } | null;

      if (body?.confirmation !== "СИНХРОНИЗИРАЙ") {
        return Response.json(
          {
            error: "Липсва потвърждение за подготовка на получателите.",
          },
          { status: 400 },
        );
      }

      const broadcast = (await req.payload.findByID({
        collection: "email-broadcasts",
        id: broadcastId,
        depth: 0,
        overrideAccess: true,
      })) as Record<string, unknown>;
      const candidates = await resolveCandidateDocs({
        broadcast,
        config,
        payload: req.payload,
      });
      const plan = buildResendContactSyncPlan({
        fields: {
          email: recipientEmailField,
          firstName: recipientFirstNameField,
          lastName: recipientLastNameField,
          subscription: subscriptionField,
        },
        propertyMappings: resendContactProperties,
        recipients: candidates,
      });

      const selectedSegmentKey = asNonEmptyString(broadcast.resendSegmentKey);
      const selectedSegment = resendSegments.find(
        (segment) => segment.key === selectedSegmentKey,
      );

      if (!selectedSegment) {
        return Response.json(
          {
            error:
              "Избери Resend сегмент за тази кампания. Сегментите се задават от developer-а в plugin config.",
          },
          { status: 400 },
        );
      }

      const segmentId = selectedSegment.resendSegmentId;
      const syncedAt = new Date().toISOString();

      await req.payload.update({
        collection: "email-broadcasts",
        id: broadcastId,
        data: {
          recipientCount: plan.contacts.length,
          resendLastError: null,
          resendLastSyncedAt: syncedAt,
          resendSegmentId: segmentId,
          skippedCount: plan.skipped.length,
          status: "synced",
          syncFailedCount: 0,
          syncedCount: plan.contacts.length,
        },
        overrideAccess: true,
      });

      return Response.json({
        ok: true,
        segmentLabel: selectedSegment.label,
        segmentId,
        summary: {
          skipped: plan.skipped.length,
          syncFailed: 0,
          synced: plan.contacts.length,
        },
      });
    },
  };
};
