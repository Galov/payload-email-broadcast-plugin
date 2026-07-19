import { canAccessAdmin, type Endpoint, type Where } from "payload";
import {
  addResendContactToSegment,
  createResendContact,
  createResendSegment,
  updateResendContact,
} from "../providers/resend.js";
import { buildResendContactSyncPlan } from "../utils/resendContacts.js";
import {
  asNonEmptyString,
  resolveCandidateDocs,
  type SendCommonConfig,
} from "../utils/sendCommon.js";
import type { ResendContactPropertyMapping } from "../utils/resendContacts.js";

type CreateSyncAudienceEndpointArgs = SendCommonConfig & {
  resendApiKey: string;
  resendContactProperties?: ResendContactPropertyMapping[];
};

const buildSegmentName = ({
  broadcast,
  broadcastId,
}: {
  broadcast: Record<string, unknown>;
  broadcastId: string;
}) => {
  const title = asNonEmptyString(broadcast.title) ?? "Untitled campaign";

  return `Payload Campaign: ${title} (${broadcastId})`;
};

const getExistingLog = async ({
  broadcastId,
  email,
  payload,
  recipientId,
}: {
  broadcastId: string;
  email?: string;
  payload: Parameters<Endpoint["handler"]>[0]["payload"];
  recipientId?: number | string;
}) => {
  const conditions: Where[] = [
    { broadcast: { equals: broadcastId } },
  ];

  if (email) {
    conditions.push({ email: { equals: email } });
  } else if (recipientId) {
    conditions.push({ recipientId: { equals: String(recipientId) } });
  } else {
    return null;
  }

  const result = await payload.find({
    collection: "email-logs",
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: {
      and: conditions,
    },
  });

  return result.docs[0] as { id?: number | string } | undefined;
};

const upsertSyncLog = async ({
  broadcastId,
  email,
  error,
  payload,
  recipientId,
  resendBroadcastId,
  resendContactId,
  resendSegmentId,
  status,
  syncedAt,
}: {
  broadcastId: string;
  email: string;
  error?: string;
  payload: Parameters<Endpoint["handler"]>[0]["payload"];
  recipientId?: number | string;
  resendBroadcastId?: string;
  resendContactId?: string;
  resendSegmentId?: string;
  status: "failed" | "pending_sync" | "skipped" | "synced";
  syncedAt?: string;
}) => {
  const data = {
    broadcast: broadcastId,
    email,
    error,
    recipientId: recipientId ? String(recipientId) : undefined,
    resendBroadcastId,
    resendContactId,
    resendSegmentId,
    status,
    syncedAt,
  };
  const existingLog = await getExistingLog({
    broadcastId,
    email,
    payload,
    recipientId,
  });

  if (existingLog?.id) {
    await payload.update({
      collection: "email-logs",
      id: existingLog.id,
      data,
      overrideAccess: true,
    });
    return;
  }

  await payload.create({
    collection: "email-logs",
    data,
    overrideAccess: true,
  });
};

export const createSyncAudienceEndpoint = ({
  recipientEmailField,
  recipientFirstNameField,
  recipientLastNameField,
  recipientsCollection,
  resendApiKey,
  resendContactProperties,
  subscriptionField,
}: CreateSyncAudienceEndpointArgs): Endpoint => {
  const config: SendCommonConfig = {
    recipientEmailField,
    recipientFirstNameField,
    recipientLastNameField,
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

      const existingSegmentId = asNonEmptyString(broadcast.resendSegmentId);
      const segmentId =
        existingSegmentId ??
        (await createResendSegment({
          apiKey: resendApiKey,
          name: buildSegmentName({ broadcast, broadcastId }),
        })).segmentId;
      const syncedAt = new Date().toISOString();
      let syncedCount = 0;
      let syncFailedCount = 0;

      for (const skipped of plan.skipped) {
        await upsertSyncLog({
          broadcastId,
          email: skipped.email ?? `missing-email:${skipped.recipientId ?? "unknown"}`,
          error: skipped.reason,
          payload: req.payload,
          recipientId: skipped.recipientId,
          resendSegmentId: segmentId,
          status: "skipped",
        });
      }

      for (const contact of plan.contacts) {
        try {
          let resendContactId: string;

          try {
            resendContactId = (await updateResendContact({
              apiKey: resendApiKey,
              email: contact.email,
              firstName: contact.firstName,
              lastName: contact.lastName,
              properties: contact.properties,
              unsubscribed: contact.unsubscribed,
            })).contactId;
          } catch {
            resendContactId = (await createResendContact({
              apiKey: resendApiKey,
              email: contact.email,
              firstName: contact.firstName,
              lastName: contact.lastName,
              properties: contact.properties,
              unsubscribed: contact.unsubscribed,
            })).contactId;
          }

          await addResendContactToSegment({
              apiKey: resendApiKey,
              email: contact.email,
              segmentId,
          });

          await upsertSyncLog({
            broadcastId,
            email: contact.email,
            payload: req.payload,
            recipientId: contact.recipientId,
            resendContactId,
            resendSegmentId: segmentId,
            status: "synced",
            syncedAt,
          });
          syncedCount += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";

          await upsertSyncLog({
            broadcastId,
            email: contact.email,
            error: message,
            payload: req.payload,
            recipientId: contact.recipientId,
            resendSegmentId: segmentId,
            status: "failed",
          });
          syncFailedCount += 1;
        }
      }

      await req.payload.update({
        collection: "email-broadcasts",
        id: broadcastId,
        data: {
          recipientCount: plan.contacts.length,
          resendLastError: syncFailedCount > 0 ? "Има неуспешни sync записи." : null,
          resendLastSyncedAt: syncedAt,
          resendSegmentId: segmentId,
          skippedCount: plan.skipped.length,
          status: syncFailedCount > 0 ? "failed" : "synced",
          syncFailedCount,
          syncedCount,
        },
        overrideAccess: true,
      });

      return Response.json({
        ok: syncFailedCount === 0,
        segmentId,
        summary: {
          skipped: plan.skipped.length,
          syncFailed: syncFailedCount,
          synced: syncedCount,
        },
      });
    },
  };
};
