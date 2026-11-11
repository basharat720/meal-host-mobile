/**
 * Fills `{name}` placeholders in a translated string. The i18n `t()` returns
 * the raw string, so values are dropped in here.
 */
export const fillTemplate = (
  template: string,
  values: Record<string, string | number>
): string =>
  template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match
  );
