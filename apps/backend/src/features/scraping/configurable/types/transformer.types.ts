/**
 * Availability status for products.
 * - available: Product found on website and in stock
 * - out_of_stock: Product found on website but marked as out of stock
 * - discontinued: Product found on website but marked as discontinued/delisted
 * - unknown: Product found on website but couldn't determine status
 * - not_found: Product was NOT found on supplier website during scrape
 */
export type AvailabilityStatus =
  | 'available'
  | 'out_of_stock'
  | 'discontinued'
  | 'unknown'
  | 'not_found';

/**
 * A field transformer validates and transforms raw extracted data.
 * This provides robust handling of unknown input with explicit validation and transformation.
 */
export interface FieldTransformer<T> {
  /**
   * Validate raw input - return false to skip/use default.
   * This is called before transform() to check if the value is processable.
   */
  validate: (raw: unknown) => boolean;

  /**
   * Transform raw input to expected type.
   * Return null if transformation fails.
   */
  transform: (raw: unknown) => T | null;

  /**
   * Is this field required?
   * If true and transform returns null, the entire product is skipped.
   */
  required: boolean;

  /**
   * Default value if not required and transform fails.
   */
  default?: T;
}

/**
 * Map of field transformers for each field in ScrapedProduct.
 * Each supplier config provides its own transformer map.
 */
export interface TransformerMap {
  /** SKU/product code - usually required but can default to empty */
  sku: FieldTransformer<string>;

  /** Supplier internal product ID */
  internal_product_id?: FieldTransformer<string>;

  /** EAN/barcode - typically required for matching */
  ean: FieldTransformer<string>;

  /** Product name */
  name: FieldTransformer<string>;

  /** Price - required, must be positive */
  price: FieldTransformer<number>;

  /** VAT rate as percentage or decimal */
  vatRate?: FieldTransformer<number>;

  /** Product availability status */
  availability?: FieldTransformer<AvailabilityStatus>;

  /** Unit size (e.g., "1x6", "Case of 12") */
  unitSize?: FieldTransformer<string>;

  /** Image URL - often used for EAN extraction */
  imageUrl?: FieldTransformer<string>;

  /** Product detail page URL */
  productUrl?: FieldTransformer<string>;
}

/**
 * Raw product data extracted from the page before transformation.
 * All fields are unknown since we don't know what we'll get from the DOM.
 */
export interface RawProduct {
  [key: string]: unknown;
}

/**
 * Options for string transformer.
 */
export interface StringTransformerOptions {
  required?: boolean;
  default?: string;
  trim?: boolean;
  maxLength?: number;
}

/**
 * Options for availability transformer.
 */
export interface AvailabilityTransformerOptions {
  defaultWhenMissing?: AvailabilityStatus;
  defaultWhenUnmapped?: AvailabilityStatus;
}
