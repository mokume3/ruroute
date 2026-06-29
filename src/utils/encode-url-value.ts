export const encodeUrlValue = (value: string | number | boolean): string =>
  encodeURIComponent(String(value));
