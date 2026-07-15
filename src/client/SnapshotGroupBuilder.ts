"use client";

import * as React from "react";

type SnapshotFilterFieldType =
  | "checkbox"
  | "date"
  | "email"
  | "number"
  | "radio"
  | "select"
  | "text";

type SnapshotFilterField = {
  label: string;
  name: string;
  options?: Array<{ label: string; value: string }>;
  type: SnapshotFilterFieldType;
};

type FilterRow = {
  field: string;
  operator: string;
  value: string;
};

type FieldsResponse = {
  fields?: SnapshotFilterField[];
};

type PreviewResponse = {
  error?: string;
  matchedCount?: number;
};

type CreateResponse = {
  error?: string;
  groupId?: number | string;
  matchedCount?: number;
  ok?: boolean;
};

const operatorLabels: Record<string, string> = {
  contains: "съдържа",
  equals: "е равно на",
  greater_than: "е след / по-голямо от",
  less_than: "е преди / по-малко от",
  not_equals: "не е равно на",
};

const operatorsByType: Record<SnapshotFilterFieldType, string[]> = {
  checkbox: ["equals"],
  date: ["equals", "greater_than", "less_than"],
  email: ["equals", "contains", "not_equals"],
  number: ["equals", "greater_than", "less_than", "not_equals"],
  radio: ["equals", "not_equals"],
  select: ["equals", "not_equals"],
  text: ["equals", "contains", "not_equals"],
};

const panelStyle: React.CSSProperties = {
  border: "1px solid var(--theme-elevation-150)",
  borderRadius: 4,
  marginBottom: 24,
  padding: 18,
};

const rowStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  gridTemplateColumns: "minmax(160px, 1fr) minmax(150px, 1fr) minmax(160px, 1fr) auto",
  marginTop: 10,
};

const inputStyle: React.CSSProperties = {
  background: "var(--theme-input-bg)",
  border: "1px solid var(--theme-elevation-150)",
  borderRadius: 4,
  boxSizing: "border-box",
  color: "var(--theme-text)",
  minHeight: 38,
  padding: "6px 8px",
};

const buttonStyle: React.CSSProperties = {
  background: "var(--theme-success-600)",
  border: "1px solid var(--theme-success-600)",
  borderRadius: 4,
  color: "var(--theme-success-50)",
  cursor: "pointer",
  fontWeight: 700,
  padding: "8px 12px",
};

const secondaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "transparent",
  border: "1px solid var(--theme-elevation-250)",
  color: "var(--theme-text)",
};

const dangerButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "transparent",
  border: "1px solid var(--theme-error-500)",
  color: "var(--theme-error-600)",
};

const mutedTextStyle: React.CSSProperties = {
  color: "var(--theme-elevation-600)",
  lineHeight: 1.5,
};

const getDefaultOperator = (field?: SnapshotFilterField) => {
  if (!field) {
    return "equals";
  }

  return operatorsByType[field.type][0] ?? "equals";
};

const getDefaultValue = (field?: SnapshotFilterField) => {
  if (!field) {
    return "";
  }

  if (field.type === "checkbox") {
    return "true";
  }

  return field.options?.[0]?.value ?? "";
};

const createInitialRow = (fields: SnapshotFilterField[]): FilterRow => {
  const firstField = fields[0];

  return {
    field: firstField?.name ?? "",
    operator: getDefaultOperator(firstField),
    value: getDefaultValue(firstField),
  };
};

const buildHeaders = () => ({
  "Content-Type": "application/json",
});

const readEventValue = (event: {
  currentTarget: unknown;
  target: unknown;
}): string => {
  const currentTarget = event.currentTarget as { value?: unknown };
  const target = event.target as { value?: unknown };
  const value = currentTarget.value ?? target.value;

  return typeof value === "string" ? value : "";
};

export const SnapshotGroupBuilder: React.FC = () => {
  const [fields, setFields] = React.useState<SnapshotFilterField[]>([]);
  const [description, setDescription] = React.useState("");
  const [groupName, setGroupName] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);
  const [message, setMessage] = React.useState("");
  const [rows, setRows] = React.useState<FilterRow[]>([]);

  React.useEffect(() => {
    let isMounted = true;

    const loadFields = async () => {
      try {
        const response = await fetch(
          "/api/email-recipient-groups/snapshot-filter-fields",
        );
        const json = (await response.json()) as FieldsResponse;
        const loadedFields = Array.isArray(json.fields) ? json.fields : [];

        if (!isMounted) {
          return;
        }

        setFields(loadedFields);
        setRows(loadedFields.length > 0 ? [createInitialRow(loadedFields)] : []);
      } catch (error) {
        if (isMounted) {
          setMessage(
            `Грешка: ${error instanceof Error ? error.message : "Неуспешно зареждане на критериите."}`,
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadFields();

    return () => {
      isMounted = false;
    };
  }, []);

  const fieldByName = new Map(fields.map((field) => [field.name, field]));

  const updateRow = (index: number, patch: Partial<FilterRow>) => {
    setRows((currentRows) =>
      currentRows.map((row, rowIndex) => {
        if (rowIndex !== index) {
          return row;
        }

        const nextRow = {
          ...row,
          ...patch,
        };

        if (patch.field) {
          const selectedField = fieldByName.get(patch.field);

          return {
            ...nextRow,
            operator: getDefaultOperator(selectedField),
            value: getDefaultValue(selectedField),
          };
        }

        return nextRow;
      }),
    );
  };

  const addRow = () => {
    setRows((currentRows) => [...currentRows, createInitialRow(fields)]);
  };

  const removeRow = (index: number) => {
    setRows((currentRows) =>
      currentRows.filter((_, rowIndex) => rowIndex !== index),
    );
  };

  const runPreview = async () => {
    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/email-recipient-groups/snapshot-preview", {
        body: JSON.stringify({ filters: rows }),
        headers: buildHeaders(),
        method: "POST",
      });
      const json = (await response.json()) as PreviewResponse;

      if (!response.ok) {
        setMessage(`Грешка: ${json.error ?? "Неуспешна проверка."}`);
        return;
      }

      setMessage(`Намерени получатели: ${json.matchedCount ?? 0}.`);
    } catch (error) {
      setMessage(
        `Грешка: ${error instanceof Error ? error.message : "Неуспешна проверка."}`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  const createGroup = async () => {
    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/email-recipient-groups/snapshot-create", {
        body: JSON.stringify({
          description,
          filters: rows,
          name: groupName,
        }),
        headers: buildHeaders(),
        method: "POST",
      });
      const json = (await response.json()) as CreateResponse;

      if (!response.ok || !json.ok) {
        setMessage(`Грешка: ${json.error ?? "Неуспешно създаване на група."}`);
        return;
      }

      setMessage(
        `Групата е създадена с ${json.matchedCount ?? 0} получатели. Можеш да я избереш в кампания.`,
      );
    } catch (error) {
      setMessage(
        `Грешка: ${error instanceof Error ? error.message : "Неуспешно създаване на група."}`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  const renderValueInput = (row: FilterRow, index: number) => {
    const selectedField = fieldByName.get(row.field);

    if (!selectedField) {
      return React.createElement("input", {
        disabled: true,
        style: inputStyle,
        value: "",
      });
    }

    if (selectedField.type === "checkbox") {
      return React.createElement(
        "select",
        {
          onChange: (event: React.ChangeEvent<HTMLSelectElement>) =>
            updateRow(index, { value: readEventValue(event) }),
          style: inputStyle,
          value: row.value,
        },
        React.createElement("option", { value: "true" }, "Да"),
        React.createElement("option", { value: "false" }, "Не"),
      );
    }

    if (selectedField.options && selectedField.options.length > 0) {
      return React.createElement(
        "select",
        {
          onChange: (event: React.ChangeEvent<HTMLSelectElement>) =>
            updateRow(index, { value: readEventValue(event) }),
          style: inputStyle,
          value: row.value,
        },
        selectedField.options.map((option) =>
          React.createElement(
            "option",
            { key: option.value, value: option.value },
            option.label,
          ),
        ),
      );
    }

    return React.createElement("input", {
      onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
        updateRow(index, { value: readEventValue(event) }),
      style: inputStyle,
      type:
        selectedField.type === "date"
          ? "date"
          : selectedField.type === "number"
            ? "number"
            : "text",
      value: row.value,
    });
  };

  if (isLoading && fields.length === 0) {
    return React.createElement(
      "div",
      { style: panelStyle },
      "Зареждане на критериите за групи...",
    );
  }

  if (fields.length === 0) {
    return React.createElement(
      "div",
      { style: panelStyle },
      React.createElement(
        "p",
        { style: { ...mutedTextStyle, margin: 0 } },
        "Няма настроени полета за създаване на групи по критерии. Добави `groupFilterFields` в plugin config.",
      ),
    );
  }

  return React.createElement(
    "div",
    { style: panelStyle },
    React.createElement(
      "h3",
      { style: { margin: "0 0 8px" } },
      "Създай нова група по критерии",
    ),
    React.createElement(
      "p",
      { style: { ...mutedTextStyle, margin: "0 0 16px" } },
      "Това създава статична група. Получателите се записват в групата и няма да се променят автоматично по-късно.",
    ),
    React.createElement(
      "label",
      { style: { display: "block", fontWeight: 600, marginBottom: 6 } },
      "Име",
    ),
    React.createElement("input", {
      onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
        setGroupName(readEventValue(event)),
      placeholder: "Име на новата група",
      style: { ...inputStyle, marginBottom: 14, width: "100%" },
      value: groupName,
    }),
    React.createElement(
      "label",
      { style: { display: "block", fontWeight: 600, marginBottom: 6 } },
      "Описание",
    ),
    React.createElement("textarea", {
      onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) =>
        setDescription(readEventValue(event)),
      placeholder: "Описание. Например: Активни членове за кампания юли 2026.",
      style: { ...inputStyle, minHeight: 70, width: "100%" },
      value: description,
    }),
    React.createElement(
      "p",
      { style: { ...mutedTextStyle, margin: "14px 0 0" } },
      "Критериите се комбинират с И. За ИЛИ създай отделни групи с ясни имена.",
    ),
    ...rows.map((row, index) => {
      const selectedField = fieldByName.get(row.field);
      const operators = selectedField ? operatorsByType[selectedField.type] : ["equals"];

      return React.createElement(
        "div",
        { key: index, style: rowStyle },
        React.createElement(
          "select",
          {
            onChange: (event: React.ChangeEvent<HTMLSelectElement>) =>
              updateRow(index, { field: readEventValue(event) }),
            style: inputStyle,
            value: row.field,
          },
          fields.map((field) =>
            React.createElement(
              "option",
              { key: field.name, value: field.name },
              field.label,
            ),
          ),
        ),
        React.createElement(
          "select",
          {
            onChange: (event: React.ChangeEvent<HTMLSelectElement>) =>
              updateRow(index, { operator: readEventValue(event) }),
            style: inputStyle,
            value: row.operator,
          },
          operators.map((operator) =>
            React.createElement(
              "option",
              { key: operator, value: operator },
              operatorLabels[operator] ?? operator,
            ),
          ),
        ),
        renderValueInput(row, index),
        React.createElement(
          "button",
          {
            disabled: rows.length === 1,
            onClick: () => removeRow(index),
            style: {
              ...dangerButtonStyle,
              opacity: rows.length === 1 ? 0.5 : 1,
            },
            type: "button",
          },
          "Премахни",
        ),
      );
    }),
    React.createElement(
      "div",
      { style: { display: "flex", gap: 8, marginTop: 12 } },
      React.createElement(
        "button",
        {
          disabled: isLoading,
          onClick: addRow,
          style: secondaryButtonStyle,
          type: "button",
        },
        "Добави критерий",
      ),
      React.createElement(
        "button",
        {
          disabled: isLoading,
          onClick: runPreview,
          style: secondaryButtonStyle,
          type: "button",
        },
        "Провери броя",
      ),
      React.createElement(
        "button",
        {
          disabled: isLoading,
          onClick: createGroup,
          style: buttonStyle,
          type: "button",
        },
        isLoading ? "Създаване..." : "Създай група",
      ),
    ),
    message
      ? React.createElement(
          "p",
          {
            style: {
              color: message.startsWith("Грешка:") ? "#b91c1c" : "#0f766e",
              margin: "12px 0 0",
            },
          },
          message,
        )
      : null,
  );
};
