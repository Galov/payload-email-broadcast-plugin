export type RenderTemplateData = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  unsubscribeUrl?: string | null;
};

const normalizeTemplateValue = (value: string | null | undefined): string => {
  if (typeof value !== "string") {
    return "";
  }

  return value;
};

export const renderTemplate = (
  template: string,
  data: RenderTemplateData,
): string => {
  const values: Record<string, string> = {
    firstName: normalizeTemplateValue(data.firstName),
    lastName: normalizeTemplateValue(data.lastName),
    email: normalizeTemplateValue(data.email),
    unsubscribeUrl: normalizeTemplateValue(data.unsubscribeUrl),
  };

  return template.replace(/\{\{\s*(firstName|lastName|email|unsubscribeUrl)\s*\}\}/g, (_, key: string) => {
    return values[key] ?? "";
  });
};
