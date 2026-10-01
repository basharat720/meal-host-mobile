/**
 * Display-cases a name: every word gets an initial capital.
 *
 * Kitchen and dish names are free text typed by chefs, so they arrive in
 * whatever case the chef used ("chicken biryani", "AL MADINA KITCHEN"). This
 * normalises them for display only — the stored value is never rewritten.
 *
 * A name that is entirely uppercase is caps-lock, not an acronym, so it gets
 * cased like any other. In a name that is only partly uppercase, all-caps
 * words are left alone so acronyms survive ("BBQ Platter", "KFC Style").
 * Letters after an apostrophe stay lowercase, so "Chef's Special" doesn't
 * become "Chef'S Special".
 */
export const toTitleCase = (value?: string | null): string => {
  if (!value) return "";
  const allCaps = value === value.toUpperCase();
  return value.replace(/[^\s/-]+/g, (word) => {
    if (!allCaps && word.length > 1 && word === word.toUpperCase() && /[A-Z]/.test(word)) {
      return word;
    }
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
};
