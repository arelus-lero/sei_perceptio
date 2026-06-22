import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 44px minimum interactive height on mobile; defers to desktop sizing at md+. */
export const touchMinHeight = "min-h-11 md:min-h-0"

/** 44px minimum interactive box on mobile for icon-only controls. */
export const touchTarget = "min-h-11 min-w-11 md:min-h-0 md:min-w-0"

/** Native select touch-friendly sizing aligned with Input. */
export const nativeSelectClass =
  "flex h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:h-8 md:text-sm md:py-1 dark:bg-input/30"
