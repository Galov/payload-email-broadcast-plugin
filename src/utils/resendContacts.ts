import { asNonEmptyString } from "./sendCommon.js";
import type { ResendContactProperties } from "../providers/resend.js";

export type ResendContactFieldMapping = {
  email: string;
  firstName?: string;
  lastName?: string;
  subscription?: string;
};

export type ResendContactPropertyMapping = {
  field: string;
  property: string;
};

export type ResendContactRecipientDoc = Record<string, unknown> & {
  id?: number | string;
};

export type ResendContactSyncContact = {
  email: string;
  firstName?: string;
  lastName?: string;
  properties?: ResendContactProperties;
  recipientId?: number | string;
  unsubscribed?: boolean;
};

export type ResendContactSyncSkippedRecipient = {
  email?: string;
  reason: "duplicate_email" | "invalid_property" | "missing_email";
  recipientId?: number | string;
};

export type BuildResendContactSyncPlanArgs = {
  fields: ResendContactFieldMapping;
  propertyMappings?: ResendContactPropertyMapping[];
  recipients: ResendContactRecipientDoc[];
};

export type BuildResendContactSyncPlanResult = {
  contacts: ResendContactSyncContact[];
  skipped: ResendContactSyncSkippedRecipient[];
};

const normalizeEmail = (value: unknown): string | null => {
  const email = asNonEmptyString(value)?.toLowerCase();

  return email ?? null;
};

const isSubscribed = (value: unknown): boolean => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.trim().toLowerCase() === "true";
  }

  if (typeof value === "number") {
    return value === 1;
  }

  return false;
};

const isValidResendPropertyName = (value: string): boolean => {
  return /^[A-Za-z0-9_]{1,50}$/.test(value);
};

const mapPropertyValue = (value: unknown): number | string | null | undefined => {
  if (value === null) {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return asNonEmptyString(value) ?? undefined;
};

export const buildResendContactSyncPlan = ({
  fields,
  propertyMappings = [],
  recipients,
}: BuildResendContactSyncPlanArgs): BuildResendContactSyncPlanResult => {
  const contacts: ResendContactSyncContact[] = [];
  const skipped: ResendContactSyncSkippedRecipient[] = [];
  const seenEmails = new Set<string>();

  for (const recipient of recipients) {
    const recipientId =
      typeof recipient.id === "number" || typeof recipient.id === "string"
        ? recipient.id
        : undefined;
    const email = normalizeEmail(recipient[fields.email]);

    if (!email) {
      skipped.push({ reason: "missing_email", recipientId });
      continue;
    }

    if (seenEmails.has(email)) {
      skipped.push({ email, reason: "duplicate_email", recipientId });
      continue;
    }

    const properties: ResendContactProperties = {};
    let hasInvalidProperty = false;

    for (const mapping of propertyMappings) {
      if (!isValidResendPropertyName(mapping.property)) {
        hasInvalidProperty = true;
        break;
      }

      const value = mapPropertyValue(recipient[mapping.field]);

      if (value !== undefined) {
        properties[mapping.property] = value;
      }
    }

    if (hasInvalidProperty) {
      skipped.push({ email, reason: "invalid_property", recipientId });
      continue;
    }

    const contact: ResendContactSyncContact = {
      email,
      recipientId,
    };
    const firstName = fields.firstName
      ? asNonEmptyString(recipient[fields.firstName])
      : null;
    const lastName = fields.lastName
      ? asNonEmptyString(recipient[fields.lastName])
      : null;

    if (firstName) {
      contact.firstName = firstName;
    }

    if (lastName) {
      contact.lastName = lastName;
    }

    if (fields.subscription) {
      contact.unsubscribed = !isSubscribed(recipient[fields.subscription]);
    }

    if (Object.keys(properties).length > 0) {
      contact.properties = properties;
    }

    seenEmails.add(email);
    contacts.push(contact);
  }

  return { contacts, skipped };
};
