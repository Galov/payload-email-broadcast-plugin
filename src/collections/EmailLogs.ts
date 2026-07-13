import type { CollectionConfig } from "payload";

export const emailLogsCollection: CollectionConfig = {
  slug: "email-logs",
  labels: {
    singular: "Имейл лог",
    plural: "Имейл логове",
  },
  admin: {
    group: "Кампании",
    description: "История на изпращането по отделен получател.",
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
    { name: "status", label: "Статус", type: "text", required: true },
    { name: "error", label: "Грешка", type: "textarea" },
    { name: "sentAt", label: "Изпратено на", type: "date" },
    { name: "providerMessageId", label: "ID от доставчика", type: "text" },
  ],
};
