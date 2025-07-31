import { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from './_lib/db';
import { features } from './_lib/config';

interface SetupStatus {
  isSetupMode: boolean;
  hasPasskeys: boolean;
  hasUserProfile: boolean;
  isSetupComplete: boolean;
  setupRequired: string[];
}

/**
 * Check setup status and requirements
 * GET /api/setup-status
 */
async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = getSupabase();
    
    // Check if we have any passkey credentials
    const { data: credentials, error: credError } = await supabase
      .from('user_credentials')
      .select('id')
      .limit(1);

    if (credError) {
      console.error('Error checking credentials:', credError);
    }

    const hasPasskeys = !credError && credentials && credentials.length > 0;

    // Check if we have user profile data in sync_metadata
    const { data: profileData, error: profileError } = await supabase
      .from('sync_metadata')
      .select('id')
      .eq('sync_type', 'user_profile')
      .limit(1);

    if (profileError) {
      console.error('Error checking user profile:', profileError);
    }

    const hasUserProfile = !profileError && profileData && profileData.length > 0;

    // Determine what setup steps are required
    const setupRequired: string[] = [];
    
    if (!hasPasskeys) {
      setupRequired.push('passkey_registration');
    }
    
    if (!hasUserProfile) {
      setupRequired.push('user_profile');
    }

    const isSetupComplete = setupRequired.length === 0;

    const status: SetupStatus = {
      isSetupMode: features.setupMode,
      hasPasskeys,
      hasUserProfile,
      isSetupComplete,
      setupRequired,
    };

    return res.status(200).json({
      success: true,
      status,
      message: isSetupComplete 
        ? 'Setup is complete' 
        : `Setup required: ${setupRequired.join(', ')}`
    });

  } catch (error) {
    console.error('Setup status check error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to check setup status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export default handler;