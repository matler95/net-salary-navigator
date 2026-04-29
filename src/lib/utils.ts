import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Category color palette - consistent across the app
export const CATEGORY_COLORS = [
  "var(--accent)",
  "oklch(0.62 0.14 148)",
  "oklch(0.74 0.13 75)",
  "oklch(0.58 0.19 25)",
  "oklch(0.52 0.018 210)",
  "oklch(0.80 0.12 180)",
];

// Get consistent color for a category name using hash
export function getCategoryColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CATEGORY_COLORS[Math.abs(hash) % CATEGORY_COLORS.length];
}
