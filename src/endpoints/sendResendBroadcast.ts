import { canAccessAdmin, type Endpoint } from "payload";
import { sendResendBroadcast } from "../providers/resend.js";
import { asNonEmptyString } from "../utils/sendCommon.js";

type CreateSendResendBroadcastEndpointArgs = {
  resendApiKey: string;
};

export const createSendResendBroadcastEndpoint = ({
  resendApiKey,
}: CreateSendResendBroadcastEndpointArgs): Endpoint => {
  return {
    method: "post",
    path: "/:id/send-resend-broadcast",
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

      if (body?.confirmation !== "ИЗПРАТИ") {
        return Response.json(
          { error: "Липсва потвърждение за реално изпращане." },
          { status: 400 },
        );
      }

      const broadcast = (await req.payload.findByID({
        collection: "email-broadcasts",
        id: broadcastId,
        depth: 0,
        overrideAccess: true,
      })) as Record<string, unknown>;
      const segmentId = asNonEmptyString(broadcast.resendSegmentId);
      const resendBroadcastId = asNonEmptyString(broadcast.resendBroadcastId);

      if (!segmentId) {
        return Response.json(
          { error: "Първо синхронизирай получателите към Resend Segment." },
          { status: 400 },
        );
      }

      if (!resendBroadcastId) {
        return Response.json(
          { error: "Първо подготви имейла за финален преглед." },
          { status: 400 },
        );
      }

      if (broadcast.status === "sent" || broadcast.resendBroadcastStatus === "sent") {
        return Response.json(
          { error: "Тази кампания вече е маркирана като изпратена." },
          { status: 400 },
        );
      }

      try {
        const result = await sendResendBroadcast({
          apiKey: resendApiKey,
          broadcastId: resendBroadcastId,
        });
        const sentAt = new Date().toISOString();

        await req.payload.update({
          collection: "email-broadcasts",
          id: broadcastId,
          data: {
            resendBroadcastId: result.broadcastId,
            resendBroadcastStatus: "sent",
            resendLastError: null,
            sentAt,
            status: "sent",
          },
          overrideAccess: true,
        });

        return Response.json({
          ok: true,
          resendBroadcastId: result.broadcastId,
          resendBroadcastStatus: "sent",
          sentAt,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        await req.payload.update({
          collection: "email-broadcasts",
          id: broadcastId,
          data: {
            resendLastError: errorMessage,
            resendBroadcastStatus: "failed",
          },
          overrideAccess: true,
        });

        return Response.json({ error: errorMessage }, { status: 500 });
      }
    },
  };
};
