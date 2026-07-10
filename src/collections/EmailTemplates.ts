import type { CollectionConfigLike } from "../types.js";

export const emailTemplatesCollection: CollectionConfigLike = {
  slug: "email-templates",
  labels: {
    singular: "Email Template",
    plural: "Email Templates",
  },
  admin: {
    useAsTitle: "name",
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
