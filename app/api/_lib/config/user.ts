/**
 * User Configuration
 * 
 * Single source of truth for the application's user ID.
 * Since this is a personal application with one user,
 * we use a hardcoded UUID that matches the database.
 * 
 * Last modified: 2025-01-09
 */

// Use a consistent UUID for the single user
// This should match the user_id in your database
export const APP_USER_ID = 'f556989c-4903-47d6-8700-0afe3d4189e5' // Your actual user ID from database

// Legacy IDs that might exist in the code
export const LEGACY_USER_IDS = [
  'f556989c-4903-47d6-8700-0afe3d4189e5',
  'f556989c-4903-47d6-8700-0afe3d4189e5'
]

/**
 * Get the current user ID based on environment
 */
export function getCurrentUserId(): string {
  // In development with auth disabled, always use the app user ID
  if (process.env.NODE_ENV === 'development' && process.env.DISABLE_AUTH_IN_DEV === 'true') {
    return APP_USER_ID
  }
  
  // In all other cases, use the app user ID
  // (since this is a single-user application)
  return APP_USER_ID
}

/**
 * Check if a user ID is valid
 */
export function isValidUserId(userId: string): boolean {
  return userId === APP_USER_ID || LEGACY_USER_IDS.includes(userId)
}

/**
 * Migrate a legacy user ID to the current format
 */
export function migrateUserId(userId: string): string {
  if (LEGACY_USER_IDS.includes(userId)) {
    return APP_USER_ID
  }
  return userId
}