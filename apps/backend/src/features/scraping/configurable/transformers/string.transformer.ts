import type { FieldTransformer, StringTransformerOptions } from '../types/transformer.types.js';

/**
 * String transformer - validates and cleans string values.
 */
export function stringTransformer(options?: StringTransformerOptions): FieldTransformer<string> {
  const trim = options?.trim ?? true;
  const maxLength = options?.maxLength;

  return {
    required: options?.required ?? false,
    default: options?.default,
    validate: (raw) => {
      if (raw === null || raw === undefined) return false;
      const str = String(raw);
      return trim ? str.trim().length > 0 : str.length > 0;
    },
    transform: (raw) => {
      if (raw === null || raw === undefined) return null;

      let str = String(raw);
      if (trim) str = str.trim();
      if (maxLength && str.length > maxLength) {
        str = str.slice(0, maxLength);
      }

      return str.length > 0 ? str : null;
    },
  };
}

/**
 * URL transformer - validates and optionally resolves relative URLs.
 */
export function urlTransformer(options?: {
  required?: boolean;
  baseUrl?: string;
}): FieldTransformer<string> {
  return {
    required: options?.required ?? false,
    validate: (raw) => typeof raw === 'string' && raw.trim().length > 0,
    transform: (raw) => {
      if (typeof raw !== 'string') return null;

      const url = raw.trim();
      if (url.length === 0) return null;

      // If baseUrl provided and URL is relative, resolve it
      if (options?.baseUrl && !url.startsWith('http')) {
        try {
          return new URL(url, options.baseUrl).toString();
        } catch {
          return url;
        }
      }

      return url;
    },
  };
}
