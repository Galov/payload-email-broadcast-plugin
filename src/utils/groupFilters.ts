import type { CollectionConfig, Field, Where } from "payload";

export type EmailBroadcastGroupFilterField =
  | string
  | {
      label?: string;
      name: string;
      options?: Array<{ label: string; value: string }>;
      type?: SnapshotFilterFieldType;
    };

export type SnapshotFilterFieldType =
  | "checkbox"
  | "date"
  | "email"
  | "number"
  | "radio"
  | "select"
  | "text";

export type SnapshotFilterField = {
  label: string;
  name: string;
  options?: Array<{ label: string; value: string }>;
  type: SnapshotFilterFieldType;
};

export type SnapshotFilterOperator =
  | "contains"
  | "equals"
  | "greater_than"
  | "less_than"
  | "not_equals";

export type SnapshotFilterRule = {
  field?: unknown;
  operator?: unknown;
  value?: unknown;
};

const supportedFieldTypes = new Set<string>([
  "checkbox",
  "date",
  "email",
  "number",
  "radio",
  "select",
  "text",
]);

const operatorByType: Record<SnapshotFilterFieldType, SnapshotFilterOperator[]> = {
  checkbox: ["equals"],
  date: ["equals", "greater_than", "less_than"],
  email: ["equals", "contains", "not_equals"],
  number: ["equals", "greater_than", "less_than", "not_equals"],
  radio: ["equals", "not_equals"],
  select: ["equals", "not_equals"],
  text: ["equals", "contains", "not_equals"],
};

const getStringLabel = (value: unknown): string | null => {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  return null;
};

const getFieldName = (field: Field): string | null => {
  if ("name" in field && typeof field.name === "string") {
    return field.name;
  }

  return null;
};

const normalizeOptions = (
  options: unknown,
): Array<{ label: string; value: string }> | undefined => {
  if (!Array.isArray(options)) {
    return undefined;
  }

  const normalized = options
    .map((option) => {
      if (typeof option === "string") {
        return {
          label: option,
          value: option,
        };
      }

      if (!option || typeof option !== "object") {
        return null;
      }

      const typedOption = option as Record<string, unknown>;
      const value = getStringLabel(typedOption.value);

      if (!value) {
        return null;
      }

      return {
        label: getStringLabel(typedOption.label) ?? value,
        value,
      };
    })
    .filter((option): option is { label: string; value: string } => option !== null);

  return normalized.length > 0 ? normalized : undefined;
};

const findTopLevelField = (
  collection: CollectionConfig | undefined,
  name: string,
): Field | null => {
  const field = collection?.fields.find((candidate) => getFieldName(candidate) === name);

  return field ?? null;
};

const inferFieldDefinition = ({
  collection,
  configuredField,
}: {
  collection?: CollectionConfig;
  configuredField: EmailBroadcastGroupFilterField;
}): SnapshotFilterField | null => {
  const fieldName =
    typeof configuredField === "string" ? configuredField : configuredField.name;
  const sourceField = findTopLevelField(collection, fieldName);
  const override =
    typeof configuredField === "string" ? undefined : configuredField;
  const sourceType =
    sourceField && "type" in sourceField && typeof sourceField.type === "string"
      ? sourceField.type
      : null;
  const fieldType = override?.type ?? sourceType;

  if (!fieldType || !supportedFieldTypes.has(fieldType)) {
    return null;
  }

  const sourceLabel =
    sourceField && "label" in sourceField ? getStringLabel(sourceField.label) : null;

  return {
    label: override?.label ?? sourceLabel ?? fieldName,
    name: fieldName,
    options:
      override?.options ??
      normalizeOptions(sourceField && "options" in sourceField ? sourceField.options : undefined),
    type: fieldType as SnapshotFilterFieldType,
  };
};

export const resolveSnapshotFilterFields = ({
  configuredFields,
  recipientsCollection,
}: {
  configuredFields?: EmailBroadcastGroupFilterField[];
  recipientsCollection?: CollectionConfig;
}): SnapshotFilterField[] => {
  if (!configuredFields || configuredFields.length === 0) {
    return [];
  }

  return configuredFields
    .map((configuredField) =>
      inferFieldDefinition({
        collection: recipientsCollection,
        configuredField,
      }),
    )
    .filter((field): field is SnapshotFilterField => field !== null);
};

const parseValue = ({
  field,
  value,
}: {
  field: SnapshotFilterField;
  value: unknown;
}): boolean | number | string | null => {
  if (field.type === "checkbox") {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      return value === "true";
    }

    return null;
  }

  if (field.type === "number") {
    const numericValue = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  return normalized.length > 0 ? normalized : null;
};

export const buildSnapshotWhere = ({
  fields,
  filters,
}: {
  fields: SnapshotFilterField[];
  filters: SnapshotFilterRule[];
}): Where | null => {
  const allowedFields = new Map(fields.map((field) => [field.name, field]));
  const whereParts: Where[] = [];

  for (const filter of filters) {
    if (typeof filter.field !== "string" || typeof filter.operator !== "string") {
      continue;
    }

    const field = allowedFields.get(filter.field);

    if (!field) {
      continue;
    }

    const operator = filter.operator as SnapshotFilterOperator;

    if (!operatorByType[field.type].includes(operator)) {
      continue;
    }

    const value = parseValue({ field, value: filter.value });

    if (value === null) {
      continue;
    }

    whereParts.push({
      [field.name]: {
        [operator]: value,
      },
    });
  }

  if (whereParts.length === 0) {
    return null;
  }

  if (whereParts.length === 1) {
    return whereParts[0] ?? null;
  }

  return {
    and: whereParts,
  };
};
