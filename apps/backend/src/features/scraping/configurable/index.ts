// Main scraper class
export { ConfigurableScraper } from './configurable.scraper.js';

// Types
export type {
  ScraperConfig,
  SupplierMeta,
  BrowserConfig,
  AuthConfig,
  AuthStep,
  SelectorStrategy,
  NavigationConfig,
  CategoryDefinition,
  SimpleCategoryDefinition,
  DepartmentCategoryDefinition,
  CustomCategoryDefinition,
  PaginationConfig,
  NavigationDelays,
  NavigationPhase,
  ExtractionConfig,
  FieldExtraction,
  ExtractionStrategy,
  SupplierDefinition,
} from './types/index.js';

export type {
  FieldTransformer,
  TransformerMap,
  RawProduct,
  AvailabilityStatus,
} from './types/index.js';

// Transformers
export {
  priceTransformer,
  createPriceTransformer,
  directEanTransformer,
  vatRateTransformer,
  availabilityTransformer,
  COMMON_AVAILABILITY_MAPPING,
  stringTransformer,
  urlTransformer,
} from './transformers/index.js';

// Executors (for advanced use cases)
export { AuthExecutor, NavigationExecutor, ExtractionExecutor } from './executors/index.js';
