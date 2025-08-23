import { clsx, type ClassValue } from 'clsx';

/**
 * Utility function to combine class names
 * Uses clsx for conditional classes and merges them efficiently
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}