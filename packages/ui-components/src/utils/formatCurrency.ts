/**
 * Format currency values for the Swedish market (SEK)
 */
export function formatCurrency(amount: number, currency = 'SEK', locale = 'sv-SE'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Format reward percentage
 */
export function formatRewardPercentage(percentage: number): string {
  return `${percentage.toFixed(1)}%`;
}