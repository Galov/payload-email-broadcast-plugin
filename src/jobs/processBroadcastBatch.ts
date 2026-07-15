import type { Payload, TaskConfig } from "payload";
import {
  DEFAULT_EMAIL_BROADCAST_BATCH_SIZE,
  PROCESS_EMAIL_BROADCAST_BATCH_TASK,
  queueEmailBroadcastJob,
  loadRecipientCandidateByID,
  sendBroadcastEmailToRecipient,
  type BroadcastSendConfig,
} from "../utils/broadcastSending.js";
import { asNonEmptyString } from "../utils/sendCommon.js";

type EmailLogDoc = {
  email?: unknown;
  id: number | string;
  recipientId?: unknown;
};

type EmailLogCounts = {
  deliveredCount: number;
  failedCount: number;
  pendingCount: number;
};

const countLogs = async ({
  broadcastId,
  payload,
}: {
  broadcastId: string;
  payload: Payload;
}): Promise<EmailLogCounts> => {
  const [sentResult, failedResult, pendingResult] = await Promise.all([
    payload.count({
      collection: "email-logs",
      overrideAccess: true,
      where: {
        broadcast: { equals: broadcastId },
        status: { equals: "sent" },
      },
    }),
    payload.count({
      collection: "email-logs",
      overrideAccess: true,
      where: {
        broadcast: { equals: broadcastId },
        status: { equals: "failed" },
      },
    }),
    payload.count({
      collection: "email-logs",
      overrideAccess: true,
      where: {
        broadcast: { equals: broadcastId },
        status: { equals: "pending" },
      },
    }),
  ]);

  return {
    deliveredCount: sentResult.totalDocs,
    failedCount: failedResult.totalDocs,
    pendingCount: pendingResult.totalDocs,
  };
};

export const createProcessEmailBroadcastBatchTask = (
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

      if (broadcast.status === "sent" || broadcast.status === "failed") {
        const counts = await countLogs({ broadcastId, payload: req.payload });

        return { output: { ...counts, processedCount: 0, queuedNextBatch: false } };
      }

      await req.payload.update({
        collection: "email-broadcasts",
        id: broadcastId,
        data: { status: "sending" },
        overrideAccess: true,
      });

      const settings = (await req.payload.findGlobal({
        slug: "email-settings",
        depth: 0,
        overrideAccess: true,
      })) as Record<string, unknown>;
      const pendingLogs = await req.payload.find({
        collection: "email-logs",
        depth: 0,
        limit: DEFAULT_EMAIL_BROADCAST_BATCH_SIZE,
        overrideAccess: true,
        pagination: false,
        sort: "createdAt",
        where: {
          broadcast: { equals: broadcastId },
          status: { equals: "pending" },
        },
      });
      let processedCount = 0;

      for (const log of pendingLogs.docs as EmailLogDoc[]) {
        const email = asNonEmptyString(log.email);

        if (!email) {
          await req.payload.update({
            collection: "email-logs",
            id: log.id,
            data: {
              error: "Липсва имейл адрес.",
              status: "skipped",
            },
            overrideAccess: true,
          });
          continue;
        }

        await req.payload.update({
          collection: "email-logs",
          id: log.id,
          data: { status: "sending" },
          overrideAccess: true,
        });

        try {
          const recipientId = asNonEmptyString(log.recipientId);
          const candidate = await loadRecipientCandidateByID({
            config,
            payload: req.payload,
            recipientId: recipientId ?? undefined,
          });
          const result = await sendBroadcastEmailToRecipient({
            broadcast,
            candidate,
            config,
            email,
            req,
            settings,
          });

          await req.payload.update({
            collection: "email-logs",
            id: log.id,
            data: {
              error: null,
              providerMessageId: result.providerMessageId,
              sentAt: new Date().toISOString(),
              status: "sent",
            },
            overrideAccess: true,
          });
        } catch (error) {
          await req.payload.update({
            collection: "email-logs",
            id: log.id,
            data: {
              error: error instanceof Error ? error.message : "Unknown error",
              status: "failed",
            },
            overrideAccess: true,
          });
        }

        processedCount += 1;
      }

      const counts = await countLogs({ broadcastId, payload: req.payload });
      const queuedNextBatch = counts.pendingCount > 0;

      await req.payload.update({
        collection: "email-broadcasts",
        id: broadcastId,
        data: {
          deliveredCount: counts.deliveredCount,
          failedCount: counts.failedCount,
          status: queuedNextBatch
            ? "sending"
            : counts.failedCount > 0
              ? "failed"
              : "sent",
          ...(queuedNextBatch ? {} : { sentAt: new Date().toISOString() }),
        },
        overrideAccess: true,
      });

      if (queuedNextBatch) {
        await queueEmailBroadcastJob({
          broadcastId,
          payload: req.payload,
        });
      }

      return {
        output: {
          ...counts,
          processedCount,
          queuedNextBatch,
        },
      };
    },
    inputSchema: [{ name: "broadcastId", type: "text", required: true }],
    label: "Process email broadcast batch",
    outputSchema: [
      { name: "processedCount", type: "number", required: true },
      { name: "pendingCount", type: "number", required: true },
      { name: "deliveredCount", type: "number", required: true },
      { name: "failedCount", type: "number", required: true },
      { name: "queuedNextBatch", type: "checkbox", required: true },
    ],
    retries: 2,
    slug: PROCESS_EMAIL_BROADCAST_BATCH_TASK,
  } as TaskConfig;
};
