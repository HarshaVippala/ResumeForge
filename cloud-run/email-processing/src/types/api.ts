// API Types for Email Processing Service
// Modified: 2025-01-11

export interface ManualSyncRequest {
  emailIds?: string[];  // Specific email IDs to process
  syncAll?: boolean;    // Process all unprocessed emails
  limit?: number;       // Max number of emails to process (default: 100)
  userEmail?: string;   // User email for context
}

export interface SyncResponse {
  success: boolean;
  message: string;
  results: {
    totalRequested: number;
    processed: number;
    failed: number;
    errors: Array<{
      emailId: string;
      error: string;
    }>;
  };
}

export interface BatchProcessRequest {
  emailIds: string[];   // Required array of email IDs
  userEmail?: string;   // Optional user context
}

export interface BatchProcessResponse {
  success: boolean;
  message: string;
  results: Array<{
    gmailId: string;
    success: boolean;
    data?: any;         // Processing result data
    error?: string;     // Error message if failed
  }>;
}

export interface StatusCheckRequest {
  emailIds: string[];   // Email IDs to check
}

export interface EmailStatus {
  processed: boolean;
  processedAt: string | null;
  isJobRelated: boolean | null;
  emailType: string | null;
  company: string | null;
  position: string | null;
}

export interface StatusCheckResponse {
  success: boolean;
  statuses: Record<string, EmailStatus>;
}

// Error response type
export interface ErrorResponse {
  success: false;
  error: string;
  message: string;
}