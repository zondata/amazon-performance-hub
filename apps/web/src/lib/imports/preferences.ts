import "server-only";

import { getPageSettings } from "@/lib/uiSettings/getPageSettings";
import { savePageSettings } from "@/lib/uiSettings/savePageSettings";
import {
  DEFAULT_IGNORED_SOURCE_TYPES,
  sanitizeIgnoredSourceTypes,
  type ImportSourceType,
} from "@/lib/imports/sourceTypes";

export const IMPORTS_HEALTH_PAGE_KEY = "imports.health";

export type ImportsHealthSettings = {
  ignored_source_types: ImportSourceType[];
};

export const getImportsHealthSettings = async (params: {
  accountId: string;
  marketplace: string;
}): Promise<ImportsHealthSettings> => {
  const raw = await getPageSettings({
    accountId: params.accountId,
    marketplace: params.marketplace,
    pageKey: IMPORTS_HEALTH_PAGE_KEY,
  });

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ignored_source_types: [...DEFAULT_IGNORED_SOURCE_TYPES] };
  }

  const record = raw as Record<string, unknown>;
  return {
    ignored_source_types: sanitizeIgnoredSourceTypes(record.ignored_source_types),
  };
};

export const saveImportsHealthSettings = async (params: {
  accountId: string;
  marketplace: string;
  ignoredSourceTypes: ImportSourceType[];
}): Promise<ImportsHealthSettings> => {
  const ignored = sanitizeIgnoredSourceTypes(params.ignoredSourceTypes);
  await savePageSettings({
    accountId: params.accountId,
    marketplace: params.marketplace,
    pageKey: IMPORTS_HEALTH_PAGE_KEY,
    settings: {
      ignored_source_types: ignored,
    },
  });
  return { ignored_source_types: ignored };
};
