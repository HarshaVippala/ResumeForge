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
      const response = await fetch('/api/oauth/status');
      const data = await response.json();
      
      if (response.ok) {
        setStatus({
          authenticated: data.authenticated,
          loading: false,
          error: null
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
      const response = await fetch('/api/oauth/disconnect', {
        method: 'POST'
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