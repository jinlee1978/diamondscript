/**
 * Practice Plan Serialization Utility
 *
 * Compresses PracticeSession data into URL-safe Base64 strings for peer-to-peer sharing.
 * No backend required - all data is transmitted within the deep link URL.
 */

import { PracticeSession } from '../data/types';

/**
 * Serialize a practice session into a URL-safe Base64 string
 */
export function serializePractice(session: PracticeSession): string {
  try {
    // Convert to JSON
    const json = JSON.stringify(session);

    // Encode to Base64 (React Native has btoa built-in)
    const base64 = btoa(json);

    // Make URL-safe by replacing characters
    const urlSafe = base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    return urlSafe;
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to serialize practice:', error);
    }
    throw new Error('Failed to serialize practice session');
  }
}

/**
 * Deserialize a URL-safe Base64 string back into a practice session
 */
export function deserializePractice(encoded: string): PracticeSession | null {
  try {
    // Restore Base64 padding and characters
    let base64 = encoded
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    // Add padding if needed
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }

    // Decode from Base64
    const json = atob(base64);

    // Parse JSON
    const session: PracticeSession = JSON.parse(json);

    // Basic validation
    if (!session.request || !session.stationLayout || !session.selectedDrills) {
      throw new Error('Invalid session structure');
    }

    return session;
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to deserialize practice:', error);
    }
    return null;
  }
}

/**
 * Generate a deep link URL for sharing a practice session
 */
export function generateShareLink(session: PracticeSession): string {
  const encoded = serializePractice(session);
  return `diamondscript://view?plan=${encoded}`;
}

/**
 * Parse a deep link URL and extract the practice session
 */
export function parseShareLink(url: string): PracticeSession | null {
  try {
    // Extract the plan parameter from the URL
    const urlObj = new URL(url);
    const encoded = urlObj.searchParams.get('plan');

    if (!encoded) {
      return null;
    }

    return deserializePractice(encoded);
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to parse share link:', error);
    }
    return null;
  }
}
