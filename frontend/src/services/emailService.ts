/**
 * Email Service for fetching real Gmail data
 * NO SENDING CAPABILITIES - READ ONLY
 */

const API_BASE_URL = 'http://localhost:5001';

export interface EmailActivity {
  id: string;
  company: string;
  subject: string;
  type: 'rejection' | 'interview' | 'recruiter' | 'follow_up' | 'offer' | 'other';
  timestamp: string;
  content: string;
  status: 'read' | 'unread';
  extractedInfo?: {
    sentiment: 'positive' | 'negative' | 'neutral';
    urgency: 'high' | 'medium' | 'low';
    nextSteps?: string[];
  };
}

export interface AttentionItem {
  id: string;
  type: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  deadline?: string;
  relatedEmails: string[];
}

export interface QuickUpdate {
  id: string;
  type: string;
  title: string;
  summary: string;
  confidence: number;
  actionable: boolean;
}

export interface DashboardData {
  emails_processed: number;
  email_activities: EmailActivity[];
  attention_items: AttentionItem[];
  quick_updates: QuickUpdate[];
}

class EmailService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  /**
   * Sync recent emails from Gmail and process them
   * This triggers email fetching, classification, and insight generation
   */
  async syncEmails(): Promise<DashboardData> {
    try {
      const response = await fetch(`${this.baseUrl}/api/emails/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Email sync failed: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Email sync failed');
      }

      return result.data;
    } catch (error) {
      console.error('Error syncing emails:', error);
      throw error;
    }
  }

  /**
   * Get cached email activities (faster than full sync)
   */
  async getEmailActivities(): Promise<EmailActivity[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/emails/activities`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch email activities: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch email activities');
      }

      return result.activities;
    } catch (error) {
      console.error('Error fetching email activities:', error);
      throw error;
    }
  }

  /**
   * Check backend connectivity and Gmail status
   */
  async checkHealth(): Promise<{
    gmail_connected: boolean;
    lm_studio_connected: boolean;
    database_status: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error checking health:', error);
      throw error;
    }
  }

  /**
   * Get email statistics for dashboard
   */
  getEmailStats(activities: EmailActivity[]) {
    const stats = {
      total: activities.length,
      unread: activities.filter(email => email.status === 'unread').length,
      interviews: activities.filter(email => email.type === 'interview').length,
      rejections: activities.filter(email => email.type === 'rejection').length,
      recruiter_outreach: activities.filter(email => email.type === 'recruiter').length,
    };

    return stats;
  }

  /**
   * Format email timestamp for display
   */
  formatTimestamp(timestamp: string): string {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);

      if (diffHours < 1) {
        return 'Just now';
      } else if (diffHours < 24) {
        return `${diffHours}h ago`;
      } else if (diffDays < 7) {
        return `${diffDays}d ago`;
      } else {
        return date.toLocaleDateString();
      }
    } catch (error) {
      return 'Unknown';
    }
  }

  /**
   * Get email type badge color
   */
  getEmailTypeBadgeColor(type: EmailActivity['type']): string {
    switch (type) {
      case 'interview':
        return 'bg-blue-500 text-white';
      case 'offer':
        return 'bg-green-500 text-white';
      case 'recruiter':
        return 'bg-purple-500 text-white';
      case 'rejection':
        return 'bg-red-500 text-white';
      case 'follow_up':
        return 'bg-yellow-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  }

  /**
   * Generate readable email type label
   */
  getEmailTypeLabel(type: EmailActivity['type']): string {
    switch (type) {
      case 'interview':
        return 'Interview';
      case 'offer':
        return 'Job Offer';
      case 'recruiter':
        return 'Recruiter Outreach';
      case 'rejection':
        return 'Rejection';
      case 'follow_up':
        return 'Follow-up';
      default:
        return 'Other';
    }
  }
}

export const emailService = new EmailService();
export default emailService;