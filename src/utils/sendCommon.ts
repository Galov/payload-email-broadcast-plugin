import type { Payload } from "payload";
import {
  buildRecipientPreview,
  type RecipientPreviewCandidate,
  type RecipientPreviewType,
} from "./recipients.js";

export type CandidateDoc = RecipientPreviewCandidate & Record<string, unknown>;

export type SendCommonConfig = {
  recipientEmailField: string;
  recipientFirstNameField?: string;
  recipientLastNameField?: string;
  recipientsCollection: string;
  subscriptionField?: string;
};

export const asNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  return normalized.length > 0 ? normalized : null;
};

export const stripHtml = (value: string): string => {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/(p|div|br|li|h1|h2|h3|h4|h5|h6)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
};

export const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

export const buildFromAddress = ({
  defaultFromEmail,
  defaultFromName,
  settings,
}: {
  defaultFromEmail?: string;
  defaultFromName?: string;
  settings: Record<string, unknown>;
}): string | null => {
  const fromEmail =
    asNonEmptyString(settings.defaultFromEmail) ?? defaultFromEmail ?? null;
  const fromName =
    asNonEmptyString(settings.defaultFromName) ?? defaultFromName ?? null;

  if (!fromEmail) {
    return null;
  }

  return fromName ? `${fromName} <${fromEmail}>` : fromEmail;
};

export const getRelationshipId = (value: unknown): number | string | null => {
  if (typeof value === "string" || typeof value === "number") {
    return value;
  }

  if (
    value &&
    typeof value === "object" &&
    "id" in value &&
    (typeof value.id === "string" || typeof value.id === "number")
  ) {
    return value.id;
  }

  return null;
};

export const resolveBroadcastTemplate = async ({
  broadcast,
  payload,
}: {
  broadcast: Record<string, unknown>;
  payload: Payload;
}): Promise<Record<string, unknown> | null> => {
  const templateId = getRelationshipId(broadcast.template);

  if (!templateId) {
    return null;
  }

  return (await payload.findByID({
    collection: "email-templates",
    id: templateId,
    depth: 1,
    overrideAccess: true,
  })) as Record<string, unknown>;
};

const getCustomRecipientIds = (broadcast: Record<string, unknown>) => {
  const customRecipients = Array.isArray(broadcast.customRecipients)
    ? broadcast.customRecipients
    : [];

  return customRecipients
    .map(getRelationshipId)
    .filter((value): value is number | string => value !== null);
};

export const resolveRecipientIdsFromGroups = async ({
  payload,
  selectedGroups,
}: {
  payload: Payload;
  selectedGroups: unknown[];
}) => {
  const groupIds = selectedGroups
    .map(getRelationshipId)
    .filter((value): value is number | string => value !== null);

  if (groupIds.length === 0) {
    return [];
  }

  const groupResult = await payload.find({
    collection: "email-recipient-groups",
    depth: 1,
    limit: groupIds.length,
    overrideAccess: true,
    pagination: false,
    where: {
      id: {
        in: groupIds,
      },
    },
  });

  const recipientIds: Array<number | string> = [];

  for (const group of groupResult.docs) {
    const typedGroup = group as Record<string, unknown>;
    const groupRecipients = Array.isArray(typedGroup.recipients)
      ? typedGroup.recipients
      : [];

    for (const recipient of groupRecipients) {
      const recipientId = getRelationshipId(recipient);

      if (recipientId) {
        recipientIds.push(recipientId);
      }
    }
  }

  return recipientIds;
};

const mapRecipientDocToCandidate = ({
  config,
  doc,
}: {
  config: SendCommonConfig;
  doc: Record<string, unknown>;
}): CandidateDoc => {
  const {
    recipientEmailField,
    recipientFirstNameField,
    recipientLastNameField,
    subscriptionField,
  } = config;

  return {
    ...doc,
    email: doc[recipientEmailField],
    id:
      typeof doc.id === "number" || typeof doc.id === "string"
        ? doc.id
        : undefined,
    ...(recipientFirstNameField
      ? { [recipientFirstNameField]: doc[recipientFirstNameField] }
      : {}),
    ...(recipientLastNameField
      ? { [recipientLastNameField]: doc[recipientLastNameField] }
      : {}),
    ...(subscriptionField
      ? { newsletterSubscribed: doc[subscriptionField] }
      : {}),
  };
};

const loadAllRecipientDocs = async ({
  config,
  payload,
}: {
  config: SendCommonConfig;
  payload: Payload;
}): Promise<CandidateDoc[]> => {
  const candidates: CandidateDoc[] = [];
  const limit = 200;
  let page = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    const result = await payload.find({
      collection: config.recipientsCollection,
      depth: 0,
      limit,
      overrideAccess: true,
      page,
    });

    candidates.push(
      ...result.docs.map((doc) =>
        mapRecipientDocToCandidate({
          config,
          doc: doc as Record<string, unknown>,
        }),
      ),
    );

    hasNextPage = result.hasNextPage === true;
    page += 1;
  }

  return candidates;
};

const loadRecipientDocsByIds = async ({
  config,
  payload,
  recipientIds,
}: {
  config: SendCommonConfig;
  payload: Payload;
  recipientIds: Array<number | string>;
}): Promise<CandidateDoc[]> => {
  if (recipientIds.length === 0) {
    return [];
  }

  const result = await payload.find({
    collection: config.recipientsCollection,
    depth: 0,
    limit: recipientIds.length,
    overrideAccess: true,
    pagination: false,
    where: {
      id: {
        in: recipientIds,
      },
    },
  });

  return result.docs.map((doc) =>
    mapRecipientDocToCandidate({
      config,
      doc: doc as Record<string, unknown>,
    }),
  );
};

export const resolveCandidateDocs = async ({
  broadcast,
  config,
  payload,
}: {
  broadcast: Record<string, unknown>;
  config: SendCommonConfig;
  payload: Payload;
}): Promise<CandidateDoc[]> => {
  if (broadcast.recipientMode === "custom" || broadcast.recipientMode === "groups") {
    const recipientIds =
      broadcast.recipientMode === "custom"
        ? getCustomRecipientIds(broadcast)
        : await resolveRecipientIdsFromGroups({
            payload,
            selectedGroups: Array.isArray(broadcast.recipientGroups)
              ? broadcast.recipientGroups
              : [],
          });

    return loadRecipientDocsByIds({
      config,
      payload,
      recipientIds,
    });
  }

  return loadAllRecipientDocs({ config, payload });
};

export const getBroadcastPreviewType = (
  broadcast: Record<string, unknown>,
): RecipientPreviewType => {
  if (broadcast.recipientMode === "subscribed") {
    return "marketing";
  }

  return broadcast.type === "marketing" ? "marketing" : "service";
};

export const buildAcceptedRecipients = ({
  broadcast,
  candidates,
  subscriptionField,
}: {
  broadcast: Record<string, unknown>;
  candidates: CandidateDoc[];
  subscriptionField?: string;
}) => {
  return buildRecipientPreview({
    candidates,
    subscriptionField,
    type: getBroadcastPreviewType(broadcast),
  }).acceptedRecipients;
};

export const resolveRenderData = ({
  candidate,
  config,
  email,
  unsubscribeUrl,
}: {
  candidate?: CandidateDoc;
  config: Pick<SendCommonConfig, "recipientFirstNameField" | "recipientLastNameField">;
  email: string;
  unsubscribeUrl: string;
}) => {
  return {
    email,
    firstName:
      (config.recipientFirstNameField
        ? asNonEmptyString(candidate?.[config.recipientFirstNameField])
        : null) ?? "",
    lastName:
      (config.recipientLastNameField
        ? asNonEmptyString(candidate?.[config.recipientLastNameField])
        : null) ?? "",
    unsubscribeUrl,
  };
};
