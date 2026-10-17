import { DEFAULT_TEMPLATE } from "./format";

const STORAGE_PREFIX = "offer-flow.template.";

export function getUserTemplate(userId: string | undefined): string {
  if (!userId) {
    return DEFAULT_TEMPLATE;
  }

  try {
    return localStorage.getItem(STORAGE_PREFIX + userId) || DEFAULT_TEMPLATE;
  } catch {
    return DEFAULT_TEMPLATE;
  }
}

export function saveUserTemplate(userId: string, template: string): void {
  try {
    if (!template.trim() || template === DEFAULT_TEMPLATE) {
      localStorage.removeItem(STORAGE_PREFIX + userId);
    } else {
      localStorage.setItem(STORAGE_PREFIX + userId, template);
    }
  } catch {
    return;
  }
}
