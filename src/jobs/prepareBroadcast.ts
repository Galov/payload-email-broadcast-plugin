import type { TaskConfig } from "payload";
import {
  PREPARE_EMAIL_BROADCAST_TASK,
  queueEmailBroadcastJob,
  type BroadcastSendConfig,
} from "../utils/broadcastSending.js";
import {
  asNonEmptyString,
  buildAcceptedRecipients,
  resolveCandidateDocs,
} from "../utils/sendCommon.js";

export const createPrepareEmailBroadcastTask = (
  config: BroadcastSendConfig,
): TaskConfig => {
  return {
    handler: async ({ input, req }) => {
      const broadcastId = asNonEmptyString(
        (input as { broadcastId?: unknown }).broadcastId,
      );

      if (!broadcastId) {
        throw new Error("Липсва ID на кампанията.");
      }

      const broadcast = (await req.payload.findByID({
        collection: "email-broadcasts",
        id: broadcastId,
        depth: 0,
        overrideAccess: true,
      })) as Record<string, unknown>;

      if (broadcast.status === "sent" || broadcast.status === "sending") {
        return { output: { preparedCount: 0, queuedBatch: false } };
      }

      const existingLogs = await req.payload.count({
        collection: "email-logs",
        overrideAccess: true,
        where: {
          broadcast: { equals: broadcastId },
        },
      });

      if (existingLogs.totalDocs > 0) {
        await queueEmailBroadcastJob({
          broadcastId,
          payload: req.payload,
        });

        return { output: { preparedCount: existingLogs.totalDocs, queuedBatch: true } };
      }

      const candidates = await resolveCandidateDocs({
        broadcast,
        config,
        payload: req.payload,
      });
      const recipients = buildAcceptedRecipients({
        broadcast,
        candidates,
        subscriptionField: config.subscriptionField,
      });

      if (recipients.length === 0) {
        await req.payload.update({
          collection: "email-broadcasts",
          id: broadcastId,
          data: {
            deliveredCount: 0,
            failedCount: 0,
            recipientCount: 0,
            status: "failed",
          },
          overrideAccess: true,
        });

        return { output: { preparedCount: 0, queuedBatch: false } };
      }

      for (const recipient of recipients) {
        await req.payload.create({
          collection: "email-logs",
          data: {
            broadcast: broadcastId,
            email: recipient.email,
            recipientId: recipient.id ? String(recipient.id) : undefined,
            status: "pending",
          },
          overrideAccess: true,
        });
      }

      await req.payload.update({
        collection: "email-broadcasts",
        id: broadcastId,
        data: {
          deliveredCount: 0,
          failedCount: 0,
          recipientCount: recipients.length,
          sentAt: null,
          status: "queued",
        },
        overrideAccess: true,
      });

      await queueEmailBroadcastJob({
        broadcastId,
        payload: req.payload,
      });

      return {
        output: {
          preparedCount: recipients.length,
          queuedBatch: true,
        },
      };
    },
    inputSchema: [{ name: "broadcastId", type: "text", required: true }],
    label: "Prepare email broadcast",
    outputSchema: [
      { name: "preparedCount", type: "number", required: true },
      { name: "queuedBatch", type: "checkbox", required: true },
    ],
    retries: 2,
    slug: PREPARE_EMAIL_BROADCAST_TASK,
  } as TaskConfig;
};
