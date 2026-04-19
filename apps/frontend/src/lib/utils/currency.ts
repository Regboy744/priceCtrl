export function formatCurrency(
 amount: number | null | undefined,
 options: {
  locale?: string
  currency?: string
 } = {},
): string {
 const locale = options.locale ?? 'en-IE'
 const currency = options.currency ?? 'EUR'

 const safeAmount =
  typeof amount === 'number' && Number.isFinite(amount) ? amount : 0

 return new Intl.NumberFormat(locale, {
  style: 'currency',
  currency,
 }).format(safeAmount)
}

export function formatPercent(
 value: number | null | undefined,
 digits: number = 1,
 locale: string = 'en-IE',
): string {
 const safeValue =
  typeof value === 'number' && Number.isFinite(value) ? value : 0

 return new Intl.NumberFormat(locale, {
  style: 'percent',
  minimumFractionDigits: digits,
  maximumFractionDigits: digits,
 }).format(safeValue)
}
