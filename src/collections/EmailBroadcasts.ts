import type { CollectionConfigLike } from "../types.js";

export const emailBroadcastsCollection: CollectionConfigLike = {
  slug: "email-broadcasts",
  labels: {
    singular: "Email Broadcast",
    plural: "Email Broadcasts",
  },
  admin: {
    useAsTitle: "title",
    description:
      "Broadcast drafts and send metadata live here. Admin actions arrive in later phases.",
  },
  fields: [
    { name: "title", type: "text", required: true },
    { name: "subject", type: "text", required: true },
    { name: "previewText", type: "text" },
    { name: "body", type: "textarea", required: true },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "draft",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Ready", value: "ready" },
        { label: "Sending", value: "sending" },
        { label: "Sent", value: "sent" },
        { label: "Failed", value: "failed" },
      ],
    },
    {
      name: "type",
      type: "select",
      required: true,
      defaultValue: "service",
      options: [
        { label: "Service", value: "service" },
        { label: "Marketing", value: "marketing" },
      ],
    },
    {
      name: "recipientMode",
      type: "select",
      required: true,
      defaultValue: "all",
      options: [
        { label: "All", value: "all" },
        { label: "Subscribed", value: "subscribed" },
        { label: "Custom", value: "custom" },
      ],
      admin: {
        description:
          "The data model behind custom recipients is intentionally deferred to a later phase.",
      },
    },
    { name: "sentAt", type: "date" },
    {
      name: "recipientCount",
      type: "number",
      defaultValue: 0,
      admin: { readOnly: true },
    },
    {
      name: "deliveredCount",
      type: "number",
      defaultValue: 0,
      admin: { readOnly: true },
    },
    {
      name: "failedCount",
      type: "number",
      defaultValue: 0,
      admin: { readOnly: true },
    },
  ],
};
