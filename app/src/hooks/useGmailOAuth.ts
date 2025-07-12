import { useState, useEffect } from 'react';

interface OAuthStatus {
  authenticated: boolean;
  loading: boolean;
  error: string | null;
}

export function useGmailOAuth() {
  const [status, setStatus] = useState<OAuthStatus>({
    authenticated: false,
    loading: true,
    error: null
  });

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      // Get API key from environment
      const apiKey = process.env.NEXT_PUBLIC_PERSONAL_API_KEY;
      
      const response = await fetch('/api/oauth/status', {
        headers: apiKey ? { 'x-api-key': apiKey } : {}
      });
      const data = await response.json();
      
      if (response.ok && data.authenticated) {
        setStatus({
          authenticated: true,
          loading: false,
          error: null
        });
      } else if (response.ok && !data.authenticated) {
        // Not authenticated but API is working
        setStatus({
          authenticated: false,
          loading: false,
          error: data.error || null
        });
      } else if (response.status === 503 && data.isConfigError) {
        // Configuration error
        setStatus({
          authenticated: false,
          loading: false,
          error: data.error || 'Gmail OAuth is not configured'
        });
      } else {
        setStatus({
          authenticated: false,
          loading: false,
          error: data.error || 'Failed to check authentication status'
        });
      }
    } catch (error) {
      setStatus({
        authenticated: false,
        loading: false,
        error: 'Network error checking authentication status'
      });
    }
  };

  const startOAuthFlow = () => {
    // Redirect to OAuth authorize endpoint
    window.location.href = '/api/oauth/authorize';
  };

  const disconnect = async () => {
    try {
      // Get API key from environment
      const apiKey = process.env.NEXT_PUBLIC_PERSONAL_API_KEY;
      
      const response = await fetch('/api/oauth/disconnect', {
        method: 'POST',
        headers: apiKey ? { 'x-api-key': apiKey } : {}
      });
      
      if (response.ok) {
        setStatus({
          authenticated: false,
          loading: false,
          error: null
        });
      } else {
        const data = await response.json();
        setStatus(prev => ({
          ...prev,
          error: data.error || 'Failed to disconnect'
        }));
      }
    } catch (error) {
      setStatus(prev => ({
        ...prev,
        error: 'Network error disconnecting Gmail'
      }));
    }
  };

  return {
    isAuthenticated: status.authenticated,
    isLoading: status.loading,
    error: status.error,
    startOAuthFlow,
    disconnect,
    checkAuthStatus
  };
}