import { useState, useCallback } from 'react';
import { toast } from 'sonner';

/**
 * Hook for tracking job application outcomes
 * Created: 2025-01-10
 */

interface TrackOutcomeData {
  jobId: string;
  resumeId?: string;
  gotResponse?: boolean;
  responseTimeDays?: number;
  gotInterview?: boolean;
  interviewRounds?: number;
  gotOffer?: boolean;
  offerAmount?: number;
  acceptedOffer?: boolean;
  feedback?: string;
  feedbackSource?: 'recruiter' | 'hiring_manager' | 'automated' | 'self' | 'other';
  rejectionReason?: string;
}

interface ApplicationOutcome {
  id: string;
  jobTitle: string;
  resumeName?: string;
  resumeScore?: number;
  gotResponse: boolean;
  responseTimeDays?: number;
  gotInterview: boolean;
  interviewRounds: number;
  gotOffer: boolean;
  offerAmount?: number;
  acceptedOffer?: boolean;
  feedback?: string;
  feedbackSource?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export function useApplicationTracking() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  /**
   * Track the outcome of a job application
   */
  const trackOutcome = useCallback(async (data: TrackOutcomeData) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/analytics/track-outcome', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to track outcome');
      }
      
      const result = await response.json();
      
      // Show success message
      if (data.gotOffer) {
        toast.success('🎉 Congratulations on the offer!');
      } else if (data.gotInterview) {
        toast.success('Great! Interview tracked successfully');
      } else if (data.gotResponse) {
        toast.success('Response tracked successfully');
      } else {
        toast.success('Application outcome updated');
      }
      
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to track outcome';
      setError(message);
      toast.error(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);
  
  /**
   * Get the current outcome for a job
   */
  const getOutcome = useCallback(async (jobId: string): Promise<ApplicationOutcome | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/analytics/track-outcome?jobId=${jobId}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch outcome');
      }
      
      const result = await response.json();
      
      if (!result.exists) {
        return null;
      }
      
      return result.outcome;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch outcome';
      setError(message);
      console.error('Error fetching outcome:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);
  
  /**
   * Quick tracking methods for common outcomes
   */
  const trackResponse = useCallback(
    (jobId: string, responseTimeDays?: number) => {
      return trackOutcome({
        jobId,
        gotResponse: true,
        responseTimeDays,
      });
    },
    [trackOutcome]
  );
  
  const trackInterview = useCallback(
    (jobId: string, interviewRounds: number = 1) => {
      return trackOutcome({
        jobId,
        gotResponse: true,
        gotInterview: true,
        interviewRounds,
      });
    },
    [trackOutcome]
  );
  
  const trackOffer = useCallback(
    (jobId: string, offerAmount?: number, accepted?: boolean) => {
      return trackOutcome({
        jobId,
        gotResponse: true,
        gotInterview: true,
        gotOffer: true,
        offerAmount,
        acceptedOffer: accepted,
      });
    },
    [trackOutcome]
  );
  
  const trackRejection = useCallback(
    (jobId: string, reason?: string, stage?: 'application' | 'interview' | 'offer') => {
      const data: TrackOutcomeData = {
        jobId,
        rejectionReason: reason,
      };
      
      // Set appropriate flags based on rejection stage
      if (stage === 'interview') {
        data.gotResponse = true;
        data.gotInterview = true;
      } else if (stage === 'offer') {
        data.gotResponse = true;
        data.gotInterview = true;
        data.gotOffer = true;
        data.acceptedOffer = false;
      }
      
      return trackOutcome(data);
    },
    [trackOutcome]
  );
  
  return {
    loading,
    error,
    trackOutcome,
    getOutcome,
    // Quick methods
    trackResponse,
    trackInterview,
    trackOffer,
    trackRejection,
  };
}