import type { CollectionConfig } from "payload";

export const emailLogsCollection: CollectionConfig = {
  slug: "email-logs",
  labels: {
    singular: "Имейл лог",
    plural: "Имейл логове",
  },
  admin: {
    group: "Кампании",
    description:
      "История на sync-а и изпращането по отделен получател. Старите send статуси остават временно за backward compatibility.",
  },
  fields: [
    {
      name: "broadcast",
      label: "Кампания",
      type: "relationship",
      relationTo: "email-broadcasts",
      required: true,
    },
    { name: "email", label: "Имейл", type: "text", required: true },
    { name: "recipientId", label: "ID на получателя", type: "text" },
    {
      name: "status",
      label: "Статус",
      type: "select",
      required: true,
      options: [
        { label: "Чака sync", value: "pending_sync" },
        { label: "Синхронизиран", value: "synced" },
        { label: "Чака", value: "pending" },
        { label: "Изпраща се", value: "sending" },
        { label: "Изпратен", value: "sent" },
        { label: "Неуспешен", value: "failed" },
        { label: "Пропуснат", value: "skipped" },
      ],
    },
    { name: "error", label: "Грешка", type: "textarea" },
    {
      name: "resendContactId",
      label: "Resend Contact ID",
      type: "text",
      admin: { readOnly: true },
    },
    {
      name: "resendSegmentId",
      label: "Resend Segment ID",
      type: "text",
      admin: { readOnly: true },
    },
    {
      name: "resendBroadcastId",
      label: "Resend Broadcast ID",
      type: "text",
      admin: { readOnly: true },
    },
    {
      name: "syncedAt",
      label: "Синхронизиран на",
      type: "date",
      admin: { readOnly: true },
    },
    { name: "sentAt", label: "Изпратено на", type: "date" },
    { name: "providerMessageId", label: "ID от доставчика", type: "text" },
  ],
};
