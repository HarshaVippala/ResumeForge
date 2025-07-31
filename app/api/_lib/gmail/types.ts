/**
 * Gmail Integration Type Definitions
 */

// OAuth Token Types
export interface OAuthTokens {
  access_token: string
  refresh_token: string
  scope: string
  token_type: string
  expiry_date: number
}

export interface EncryptedTokens {
  encrypted_data: string
  iv: string
  auth_tag: string
  salt: string
  created_at: string
  expires_at: string
}

export interface StoredOAuthTokens {
  user_id: string
  encrypted_tokens: EncryptedTokens
  email_address: string
  scopes: string[]
  created_at: string
  updated_at: string
}

// Gmail API Types
export interface GmailMessage {
  id: string
  threadId: string
  labelIds: string[]
  snippet: string
  historyId: string
  internalDate: string
  payload: GmailMessagePart
  sizeEstimate: number
  raw?: string
}

export interface GmailMessagePart {
  partId: string
  mimeType: string
  filename: string
  headers: GmailHeader[]
  body: GmailMessageBody
  parts?: GmailMessagePart[]
}

export interface GmailHeader {
  name: string
  value: string
}

export interface GmailMessageBody {
  attachmentId?: string
  size: number
  data?: string
}

export interface GmailThread {
  id: string
  historyId: string
  messages: GmailMessage[]
}

export interface GmailListMessagesResponse {
  messages: Array<{ id: string; threadId: string }>
  nextPageToken?: string
  resultSizeEstimate: number
}

export interface GmailListThreadsResponse {
  threads: Array<{ id: string; historyId: string; snippet: string }>
  nextPageToken?: string
  resultSizeEstimate: number
}

// Watch/Push Notification Types
export interface GmailWatchRequest {
  labelIds?: string[]
  labelFilterAction?: 'include' | 'exclude'
  topicName: string
}

export interface GmailWatchResponse {
  historyId: string
  expiration: string
}

export interface PubSubMessage {
  message: {
    data: string
    messageId: string
    publishTime: string
  }
  subscription: string
}

export interface GmailHistoryEvent {
  emailAddress: string
  historyId: number
}

// Sync Types
export interface SyncState {
  lastHistoryId: string
  lastSyncTime: Date
  syncStatus: 'idle' | 'syncing' | 'error'
  errorMessage?: string
}

export interface SyncResult {
  emailsSynced: number
  threadsUpdated: number
  errors: Array<{ emailId: string; error: string }>
  duration: number
}

// Email Processing Types
export interface ProcessedEmail {
  id: string
  messageId: string
  threadId: string
  historyId: string
  
  // Content
  subject: string
  snippet: string
  bodyText: string
  bodyHtml: string
  
  // Metadata
  senderEmail: string
  senderName: string
  recipientEmails: string[]
  receivedAt: Date
  gmailLabels: string[]
  
  // Raw data
  rawEmail: GmailMessage
  
  // Processing flags
  isJobRelated?: boolean
  jobRelevanceConfidence?: number
  extractedData?: ExtractedJobData
}

export interface ExtractedJobData {
  company?: string
  position?: string
  status?: string
  dates?: {
    interview?: Date
    deadline?: Date
    followup?: Date
  }
  contacts?: {
    recruiter?: ContactInfo
    hiringManager?: ContactInfo
  }
  metadata?: {
    salary?: string
    location?: string
    requirements?: string[]
  }
}

export interface ContactInfo {
  name: string
  email: string
  phone?: string
  title?: string
}

// Error Types
export interface GmailError extends Error {
  code?: number
  errors?: Array<{
    domain: string
    reason: string
    message: string
  }>
}

// Service Configuration
export interface GmailServiceConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  scopes: string[]
  pubsubTopic?: string
  watchRenewalInterval?: number // in hours
}

// Queue Types
export interface EmailProcessingJob {
  id: string
  type: 'process_email' | 'sync_batch' | 'generate_insights'
  priority: number
  payload: any
  status: 'pending' | 'processing' | 'completed' | 'failed'
  attempts: number
  scheduledAt: Date
  error?: string
}

// Thread management types
export type ThreadSentiment = 'positive' | 'neutral' | 'negative'
export type ConversationStage = 'initial' | 'ongoing' | 'closing'
export type ApplicationStatus = 'inquiry' | 'applied' | 'screening' | 'interview' | 'offer' | 'rejected' | 'withdrawn'

export interface ThreadParticipant {
  email: string
  name: string | null
  role: string
  messageCount: number
}

// Updated EmailThread interface to match the new implementation
// Note: This interface is now computed from the emails table, not stored in a separate table
export interface EmailThread {
  id: string                          // Thread ID (gmail_thread_id)
  gmail_thread_id: string
  subject_normalized: string
  participants: {
    internal: ThreadParticipant[]
    external: ThreadParticipant[]
  }
  primary_company: string | null
  primary_job_id: string | null
  first_message_at: Date
  last_message_at: Date
  message_count: number
  thread_status: string               // Computed: 'active' | 'requires_response' | 'unread' | 'job_related'
  job_application_status: string | null // Computed from email content
  requires_response: boolean          // Computed from latest email
  last_response_at: Date | null
  thread_summary: string | null       // Computed from thread emails
  thread_sentiment: ThreadSentiment | null // Computed sentiment analysis
  conversation_stage: ConversationStage | null // Computed conversation stage
  ai_confidence: number | null        // Computed AI processing confidence
  created_at: Date                    // First email timestamp
  updated_at: Date                    // Last email timestamp
}

export interface ThreadSummary {
  threadId: string
  summary: string
  sentiment: ThreadSentiment
  stage: ConversationStage
  requiresResponse: boolean
  lastResponseAt: Date | null
}

export interface StatusProgression {
  fromStatus: ApplicationStatus
  toStatus: ApplicationStatus
  detectedAt: Date
  confidence: number
  evidenceText: string
}