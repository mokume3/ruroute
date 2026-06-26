export const encodeUrlValue = (value: string | number | boolean): string => {
  return encodeURIComponent(String(value));
};
