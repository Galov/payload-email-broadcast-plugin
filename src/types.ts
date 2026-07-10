export type FieldOption = {
  label: string;
  value: string;
};

export type FieldType =
  | "text"
  | "textarea"
  | "select"
  | "date"
  | "number"
  | "relationship";

export type FieldConfigLike = {
  name: string;
  type: FieldType;
  required?: boolean;
  relationTo?: string;
  hasMany?: boolean;
  defaultValue?: string | number;
  options?: FieldOption[];
  admin?: {
    description?: string;
    readOnly?: boolean;
  };
};

export type CollectionConfigLike = {
  slug: string;
  labels?: {
    singular: string;
    plural: string;
  };
  admin?: {
    useAsTitle?: string;
    description?: string;
  };
  fields: FieldConfigLike[];
};

export type GlobalConfigLike = {
  slug: string;
  label?: string;
  admin?: {
    description?: string;
  };
  fields: FieldConfigLike[];
};

export type PayloadConfigLike = {
  collections?: CollectionConfigLike[];
  globals?: GlobalConfigLike[];
};
