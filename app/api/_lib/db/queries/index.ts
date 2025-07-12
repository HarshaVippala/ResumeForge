/**
 * Database query helpers - centralized export
 * Updated: 2025-01-07
 */

// Re-export all query functions
export * from './job-queries';
export * from './resume-queries';
export * from './email-queries';

// Re-export main database functions
export { 
  getSupabase,
  testConnection,
  createJob,
  getJobWithRelations,
  updateJobStatus,
  createResume,
  getResumeWithSections,
  upsertEmail,
  linkEmailToJob,
  upsertContact,
  logActivity,
  checkV2SchemaAvailable,
  migrateJobToV2
} from '../index';