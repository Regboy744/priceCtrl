import JsBarcode from 'jsbarcode'

export type BarcodeFormat = 'CODE128'

export interface BarcodeRenderOptions {
 format?: BarcodeFormat
 width?: number
 height?: number
 displayValue?: boolean
 fontSize?: number
 textMargin?: number
 margin?: number
 lineColor?: string
 background?: string
 font?: string
}

const DEFAULT_FORMAT: BarcodeFormat = 'CODE128'

const DEFAULT_OPTIONS: BarcodeRenderOptions = {
 format: DEFAULT_FORMAT,
 width: 2,
 height: 80,
 displayValue: true,
 fontSize: 16,
 textMargin: 3,
 margin: 6,
 lineColor: '#111111',
 background: '#ffffff',
 font: 'monospace',
}

// Keep this map for future brand-specific formats.
const BRAND_FORMAT_OVERRIDES: Record<string, BarcodeFormat> = {}

export function resolveBarcodeFormat(
 articleCode: string,
 brandName?: string | null,
): BarcodeFormat {
 if (!articleCode.trim()) {
  return DEFAULT_FORMAT
 }

 const normalizedBrand = brandName?.trim().toLowerCase()
 if (normalizedBrand && BRAND_FORMAT_OVERRIDES[normalizedBrand]) {
  return BRAND_FORMAT_OVERRIDES[normalizedBrand]
 }

 return DEFAULT_FORMAT
}

export function renderBarcodeToSvg(
 svgElement: SVGSVGElement,
 articleCode: string,
 options: BarcodeRenderOptions = {},
): void {
 const value = articleCode.trim()
 if (!value) {
  throw new Error('Article code is required for barcode rendering')
 }

 let validBarcode = true

 JsBarcode(svgElement, value, {
  ...DEFAULT_OPTIONS,
  ...options,
  valid: (isValid: boolean) => {
   validBarcode = isValid
  },
 })

 if (!validBarcode) {
  throw new Error(`Invalid article code for barcode format: ${articleCode}`)
 }
}
