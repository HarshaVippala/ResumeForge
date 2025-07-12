// Example: Dashboard Integration with Email Processing Service
// Modified: 2025-01-11

import type { 
  ManualSyncRequest, 
  SyncResponse,
  BatchProcessRequest,
  BatchProcessResponse,
  StatusCheckRequest,
  StatusCheckResponse 
} from '../src/types/api';

// Configuration
const EMAIL_PROCESSOR_URL = process.env.NEXT_PUBLIC_EMAIL_PROCESSOR_URL || 'http://localhost:8080';

/**
 * Email Processing Service Client
 */
export class EmailProcessorClient {
  private baseUrl: string;

  constructor(baseUrl: string = EMAIL_PROCESSOR_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Sync emails - process specific IDs or all unprocessed
   */
  async syncEmails(request: ManualSyncRequest): Promise<SyncResponse> {
    const response = await fetch(`${this.baseUrl}/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Sync failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Process a batch of specific emails
   */
  async processBatch(emailIds: string[], userEmail?: string): Promise<BatchProcessResponse> {
    const request: BatchProcessRequest = { emailIds, userEmail };
    
    const response = await fetch(`${this.baseUrl}/process-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Batch processing failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Check processing status of emails
   */
  async checkStatus(emailIds: string[]): Promise<StatusCheckResponse> {
    const request: StatusCheckRequest = { emailIds };
    
    const response = await fetch(`${this.baseUrl}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Status check failed: ${response.statusText}`);
    }

    return response.json();
  }
}

// Usage Examples

/**
 * Example 1: Process all unprocessed emails
 */
export async function syncAllUnprocessedEmails() {
  const client = new EmailProcessorClient();
  
  try {
    const result = await client.syncEmails({
      syncAll: true,
      limit: 50, // Process up to 50 emails
    });
    
    console.log(`Processed ${result.results.processed} emails`);
    if (result.results.failed > 0) {
      console.error('Failed emails:', result.results.errors);
    }
  } catch (error) {
    console.error('Sync failed:', error);
  }
}

/**
 * Example 2: Process specific emails from selection
 */
export async function processSelectedEmails(selectedIds: string[]) {
  const client = new EmailProcessorClient();
  
  try {
    const result = await client.processBatch(selectedIds);
    
    // Handle results
    result.results.forEach((emailResult) => {
      if (emailResult.success) {
        console.log(`✓ Processed ${emailResult.gmailId}`);
      } else {
        console.error(`✗ Failed ${emailResult.gmailId}: ${emailResult.error}`);
      }
    });
  } catch (error) {
    console.error('Batch processing failed:', error);
  }
}

/**
 * Example 3: Check and process only unprocessed emails
 */
export async function processUnprocessedFromList(emailIds: string[]) {
  const client = new EmailProcessorClient();
  
  try {
    // First check status
    const statusResult = await client.checkStatus(emailIds);
    
    // Filter unprocessed emails
    const unprocessedIds = emailIds.filter(
      id => !statusResult.statuses[id]?.processed
    );
    
    if (unprocessedIds.length === 0) {
      console.log('All emails already processed');
      return;
    }
    
    // Process unprocessed emails
    const processResult = await client.processBatch(unprocessedIds);
    console.log(`Processed ${processResult.results.filter(r => r.success).length} emails`);
  } catch (error) {
    console.error('Processing failed:', error);
  }
}

/**
 * Example 4: React Hook for email processing
 */
export function useEmailProcessor() {
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const client = React.useMemo(() => new EmailProcessorClient(), []);

  const processEmails = React.useCallback(async (emailIds: string[]) => {
    setIsProcessing(true);
    setError(null);
    
    try {
      const result = await client.processBatch(emailIds);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed');
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [client]);

  const syncAll = React.useCallback(async (limit: number = 100) => {
    setIsProcessing(true);
    setError(null);
    
    try {
      const result = await client.syncEmails({ syncAll: true, limit });
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [client]);

  return {
    processEmails,
    syncAll,
    isProcessing,
    error,
  };
}