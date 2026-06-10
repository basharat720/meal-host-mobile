
/**
 * Maps language codes to their default country/currency for the purpose of this app.
 * In a real app, this might come from user settings or geo-IP.
 */
export const getCurrencyConfig = (language: string) => {
  const map: Record<string, { currency: string; locale: string }> = {
    en: { currency: "NOK", locale: "nb-NO" },
    no: { currency: "NOK", locale: "nb-NO" },
    nb: { currency: "NOK", locale: "nb-NO" },
    default: { currency: "NOK", locale: "nb-NO" },
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
    return `kr ${amount}`;
  }
};
