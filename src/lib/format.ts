export function formatCentsToCurrency(cents: number, currency = 'PHP') {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency }).format(cents / 100);
}
