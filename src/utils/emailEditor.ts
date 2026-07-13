import {
  BoldFeature,
  FixedToolbarFeature,
  HeadingFeature,
  InlineToolbarFeature,
  ItalicFeature,
  lexicalEditor,
  LinkFeature,
  OrderedListFeature,
  ParagraphFeature,
  StrikethroughFeature,
  UnderlineFeature,
  UnorderedListFeature,
  UploadFeature,
} from "@payloadcms/richtext-lexical";

export const createEmailRichTextEditor = (
  mediaCollection: string,
): ReturnType<typeof lexicalEditor> => {
  return lexicalEditor({
    features: () => {
      return [
        ParagraphFeature(),
        BoldFeature(),
        ItalicFeature(),
        UnderlineFeature(),
        StrikethroughFeature(),
        OrderedListFeature(),
        UnorderedListFeature(),
        HeadingFeature({ enabledHeadingSizes: ["h2", "h3", "h4"] }),
        LinkFeature(),
        UploadFeature({
          collections: {
            [mediaCollection]: {
              fields: [],
            },
          },
        }),
        FixedToolbarFeature(),
        InlineToolbarFeature(),
      ];
    },
  });
};
