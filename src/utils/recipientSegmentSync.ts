import type {
  CollectionAfterChangeHook,
  CollectionConfig,
  Field,
} from "payload";
import {
  addResendContactToSegment,
  createResendContact,
  removeResendContactFromSegment,
  updateResendContact,
} from "../providers/resend.js";
import type { ResendContactPropertyMapping } from "./resendContacts.js";

export type EmailBroadcastResendSegmentConfig = {
  defaultChecked?: boolean;
  key: string;
  label: string;
  resendSegmentId: string;
};

type AddRecipientSegmentSyncArgs = {
  collection: CollectionConfig;
  fieldName: string;
  recipientEmailField: string;
  recipientFirstNameField?: string;
  recipientLastNameField?: string;
  resendApiKey: string;
  resendContactProperties?: ResendContactPropertyMapping[];
  segments: EmailBroadcastResendSegmentConfig[];
  subscriptionField?: string;
};

const segmentKeyPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const validateResendSegments = (
  segments: EmailBroadcastResendSegmentConfig[] | undefined,
): EmailBroadcastResendSegmentConfig[] => {
  const safeSegments = Array.isArray(segments) ? segments : [];
  const seenKeys = new Set<string>();

  for (const segment of safeSegments) {
    if (!segmentKeyPattern.test(segment.key)) {
      throw new Error(
        `Invalid resend segment key "${segment.key}". Use letters, numbers and underscores, starting with a letter or underscore.`,
      );
    }

    if (seenKeys.has(segment.key)) {
      throw new Error(`Duplicate resend segment key "${segment.key}".`);
    }

    if (!segment.resendSegmentId) {
      throw new Error(`Missing resendSegmentId for segment "${segment.key}".`);
    }

    seenKeys.add(segment.key);
  }

  return safeSegments;
};

const readStringField = (
  doc: Record<string, unknown>,
  fieldName: string | undefined,
): string | undefined => {
  if (!fieldName) {
    return undefined;
  }

  const value = doc[fieldName];

  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
};

const readSegmentFlags = (
  doc: Record<string, unknown> | undefined,
  fieldName: string,
): Record<string, boolean> => {
  const value = doc?.[fieldName];

  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, boolean>)
    : {};
};

const buildContactProperties = ({
  doc,
  mappings,
}: {
  doc: Record<string, unknown>;
  mappings?: ResendContactPropertyMapping[];
}) => {
  if (!mappings?.length) {
    return undefined;
  }

  return mappings.reduce<Record<string, number | string | null>>((properties, mapping) => {
    const value = doc[mapping.field];

    if (
      value === null ||
      typeof value === "number" ||
      typeof value === "string"
    ) {
      properties[mapping.property] = value;
    }

    return properties;
  }, {});
};

const syncRecipientSegments = async ({
  doc,
  fieldName,
  previousDoc,
  recipientEmailField,
  recipientFirstNameField,
  recipientLastNameField,
  req,
  resendApiKey,
  resendContactProperties,
  segments,
  subscriptionField,
}: {
  doc: Record<string, unknown>;
  fieldName: string;
  previousDoc?: Record<string, unknown>;
  recipientEmailField: string;
  recipientFirstNameField?: string;
  recipientLastNameField?: string;
  req: Parameters<CollectionAfterChangeHook>[0]["req"];
  resendApiKey: string;
  resendContactProperties?: ResendContactPropertyMapping[];
  segments: EmailBroadcastResendSegmentConfig[];
  subscriptionField?: string;
}) => {
  const email = readStringField(doc, recipientEmailField);

  if (!email) {
    return;
  }

  const previousEmail = readStringField(previousDoc ?? {}, recipientEmailField);
  const currentFlags = readSegmentFlags(doc, fieldName);
  const previousFlags = readSegmentFlags(previousDoc, fieldName);
  const firstName = readStringField(doc, recipientFirstNameField);
  const lastName = readStringField(doc, recipientLastNameField);
  const unsubscribed =
    subscriptionField && doc[subscriptionField] === false ? true : undefined;
  const properties = buildContactProperties({
    doc,
    mappings: resendContactProperties,
  });

  try {
    await updateResendContact({
      apiKey: resendApiKey,
      email,
      firstName,
      lastName,
      properties,
      unsubscribed,
    });
  } catch {
    await createResendContact({
      apiKey: resendApiKey,
      email,
      firstName,
      lastName,
      properties,
      unsubscribed,
    });
  }

  if (previousEmail && previousEmail !== email) {
    await Promise.allSettled(
      segments.map((segment) =>
        removeResendContactFromSegment({
          apiKey: resendApiKey,
          email: previousEmail,
          segmentId: segment.resendSegmentId,
        }),
      ),
    );
  }

  await Promise.all(
    segments.map(async (segment) => {
      const isEnabled = currentFlags[segment.key] === true;
      const wasEnabled = previousFlags[segment.key] === true;

      if (isEnabled) {
        await addResendContactToSegment({
          apiKey: resendApiKey,
          email,
          segmentId: segment.resendSegmentId,
        });
        return;
      }

      if (wasEnabled || previousEmail !== email) {
        await removeResendContactFromSegment({
          apiKey: resendApiKey,
          email,
          segmentId: segment.resendSegmentId,
        });
      }
    }),
  );
};

export const addRecipientSegmentSyncToCollection = ({
  collection,
  fieldName,
  recipientEmailField,
  recipientFirstNameField,
  recipientLastNameField,
  resendApiKey,
  resendContactProperties,
  segments,
  subscriptionField,
}: AddRecipientSegmentSyncArgs): CollectionConfig => {
  if (!segments.length) {
    return collection;
  }

  const segmentField: Field = {
    name: fieldName,
    label: "Имейл сегменти",
    type: "group",
    admin: {
      description:
        "Избери в кои постоянни Resend сегменти участва този запис.",
    },
    fields: segments.map((segment) => ({
      name: segment.key,
      label: segment.label,
      type: "checkbox",
      defaultValue: segment.defaultChecked === true,
    })),
  };

  const syncHook: CollectionAfterChangeHook = async ({
    doc,
    previousDoc,
    req,
  }) => {
    try {
      await syncRecipientSegments({
        doc: doc as Record<string, unknown>,
        fieldName,
        previousDoc: previousDoc as Record<string, unknown> | undefined,
        recipientEmailField,
        recipientFirstNameField,
        recipientLastNameField,
        req,
        resendApiKey,
        resendContactProperties,
        segments,
        subscriptionField,
      });
    } catch (err) {
      req.payload.logger.error({
        err,
        msg: "Failed to sync recipient Resend segments.",
      });
    }

    return doc;
  };

  return {
    ...collection,
    fields: [...collection.fields, segmentField],
    hooks: {
      ...collection.hooks,
      afterChange: [...(collection.hooks?.afterChange ?? []), syncHook],
    },
  };
};
