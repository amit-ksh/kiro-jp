export type ExportValue =
  | null
  | boolean
  | number
  | string
  | ExportValue[]
  | { [key: string]: ExportValue };
export const exportCollections = [
  "profile",
  "studyEvents",
  "studySessions",
  "lessonAssessments",
  "reviewTracks",
  "reviewOpportunities",
  "reviewAttempts",
  "reviewAssessments",
  "reviewChanges",
  "savedPhrases",
  "conversations",
  "conversationSegments",
  "conversationMessages",
  "conversationJobs",
  "lessonConversationGoals",
  "wanikaniImports",
  "culturalSelections",
  "qlooContextCache",
  "speechAttempts",
  "speechDeletions",
  "readbackAssets",
  "dailyConversations",
] as const;
export type ExportCollection = (typeof exportCollections)[number];
const privateFields = new Set([
  "trace",
  "storageid",
  "uri",
  "fileuri",
  "directory",
  "path",
  "authorization",
  "password",
  "passwordhash",
  "secret",
  "token",
  "accesstoken",
  "refreshtoken",
  "apikey",
  "verificationcode",
  "jwt",
  "privatekey",
]);

/** Retain learning text verbatim; omit operational credentials and file handles. */
export function exportValue(value: unknown): ExportValue {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(exportValue);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key, item]) =>
            item !== undefined &&
            !privateFields.has(key.replace(/[_-]/gu, "").toLowerCase()),
        )
        .map(([key, item]) => [key, exportValue(item)]),
    );
  throw new Error(
    "A saved learning record could not be exported. Your data has not been changed.",
  );
}
export interface ExportPage {
  accountId: string;
  records: ExportValue[];
  done: boolean;
  cursor: string;
  pageStatus?: "SplitRecommended" | "SplitRequired" | null;
  splitCursor?: string | null;
}
export async function collectCloudExport(
  accountId: string,
  fetchPage: (
    collection: ExportCollection,
    cursor: string | null,
    endCursor?: string,
  ) => Promise<ExportPage>,
  checkActive: () => void,
  progress: (collection: ExportCollection, records: number) => void = () => {},
) {
  const collections: Partial<Record<ExportCollection, ExportValue[]>> = {};
  for (const collection of exportCollections) {
    let cursor: string | null = null;
    const seen = new Set<string>(),
      records: ExportValue[] = [];
    const splitRanges = new Set<string>();
    async function completePage(
      start: string | null,
      end?: string,
    ): Promise<ExportPage> {
      checkActive();
      const page = await fetchPage(collection, start, end);
      checkActive();
      if (page.accountId !== accountId)
        throw new Error("Your account changed. Start the export again.");
      if (page.pageStatus !== "SplitRequired") return page;
      const split = page.splitCursor,
        key = JSON.stringify([start, end]);
      if (
        !split ||
        !page.cursor ||
        split === start ||
        split === page.cursor ||
        splitRanges.has(key)
      )
        throw new Error(
          "The export could not finish reading a large page. Please retry.",
        );
      splitRanges.add(key);
      // Discard the incomplete page. Read both (start, split] and
      // (split, original end] before advancing the original continuation.
      const left = await completePage(start, split);
      const right = await completePage(split, page.cursor);
      return {
        ...page,
        records: [...left.records, ...right.records],
        pageStatus: null,
      };
    }
    for (;;) {
      const page = await completePage(cursor);
      records.push(...page.records.map(exportValue));
      progress(collection, records.length);
      if (page.done) break;
      if (!page.cursor || seen.has(page.cursor))
        throw new Error(
          "The export could not finish reading saved data. Please retry.",
        );
      seen.add(page.cursor);
      cursor = page.cursor;
    }
    collections[collection] = records;
  }
  return collections as Record<ExportCollection, ExportValue[]>;
}
