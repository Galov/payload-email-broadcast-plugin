import type { CollectionConfigLike } from "../types.js";

export const emailLogsCollection: CollectionConfigLike = {
  slug: "email-logs",
  labels: {
    singular: "Email Log",
    plural: "Email Logs",
  },
  admin: {
    description: "Per-recipient delivery records for broadcast activity.",
  },
  fields: [
    {
      name: "broadcast",
      type: "relationship",
      relationTo: "email-broadcasts",
      required: true,
    },
    { name: "email", type: "text", required: true },
    { name: "recipientId", type: "text" },
    { name: "status", type: "text", required: true },
    { name: "error", type: "textarea" },
    { name: "sentAt", type: "date" },
    { name: "providerMessageId", type: "text" },
  ],
};
