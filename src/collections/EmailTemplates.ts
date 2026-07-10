import type { CollectionConfig } from "payload";

export const emailTemplatesCollection: CollectionConfig = {
  slug: "email-templates",
  labels: {
    singular: "Email Template",
    plural: "Email Templates",
  },
  admin: {
    useAsTitle: "name",
    group: "Broadcasts",
    description: "Reusable broadcast template skeletons.",
  },
  fields: [
    { name: "name", type: "text", required: true },
    { name: "subject", type: "text", required: true },
    { name: "previewText", type: "text" },
    { name: "body", type: "textarea", required: true },
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
  ],
};
