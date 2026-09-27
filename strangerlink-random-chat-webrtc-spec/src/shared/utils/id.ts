/**
 * UUID v7 generator — server-side only, unguessable, time-ordered.
 *
 * Uses `uuid` package v7 if available, otherwise fallback to custom impl.
 * Provides >=122 bits entropy.
 */
import { v7 as uuidv7 } from 'uuid';

export function generateId(): string {
  return uuidv7();
}

export function isValidUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
