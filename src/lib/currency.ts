
/**
 * Maps language codes to their default country/currency for the purpose of this app.
 * In a real app, this might come from user settings or geo-IP.
 */
export const getCurrencyConfig = (language: string) => {
  const map: Record<string, { currency: string; locale: string }> = {
    en: { currency: "PKR", locale: "en-PK" },
    ur: { currency: "PKR", locale: "ur-PK" },
    default: { currency: "PKR", locale: "en-PK" },
  };

  return map[language] || map[language.split("-")[0]] || map.default;
};


export const formatCurrency = (amount: number, language: string): string => {
  const config = getCurrencyConfig(language);

  try {
    return new Intl.NumberFormat(config.locale, {
      style: "currency",
      currency: config.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch (e) {
    return `Rs ${amount}`;
  }
};
