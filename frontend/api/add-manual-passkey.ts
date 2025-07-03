import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from './_lib/db';
import { createSessionToken, setAuthCookie } from './_lib/auth/session';

/**
 * Manual passkey entry for Harsha - bypasses WebAuthn for initial setup
 * This creates a dummy passkey entry so you can use the login page immediately
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method === 'GET') {
    // Return a simple UI to trigger the POST request
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Add Manual Passkey - ResumeForge</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            padding: 40px; 
            max-width: 500px; 
            margin: 0 auto; 
            background: #f8fafc;
        }
        .container {
            background: white;
            padding: 32px;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
            text-align: center;
        }
        h1 { 
            color: #1e293b; 
            margin-bottom: 16px;
            font-size: 24px;
            font-weight: 600;
        }
        p {
            color: #64748b;
            margin-bottom: 24px;
        }
        button { 
            background: #3b82f6;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 500;
            cursor: pointer;
            width: 100%;
        }
        button:hover { background: #2563eb; }
        button:disabled { 
            background: #94a3b8; 
            cursor: not-allowed; 
        }
        .success { color: #10b981; margin-top: 16px; }
        .error { color: #ef4444; margin-top: 16px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔐 Add Manual Passkey</h1>
        <p>This will create a manual passkey entry for testing purposes.</p>
        
        <button onclick="addManualPasskey()" id="addBtn">
            Add Manual Passkey
        </button>
        
        <div id="result"></div>
    </div>

    <script>
        async function addManualPasskey() {
            const btn = document.getElementById('addBtn');
            const resultDiv = document.getElementById('result');
            
            btn.disabled = true;
            btn.textContent = 'Adding...';
            resultDiv.innerHTML = '';
            
            try {
                const response = await fetch('/api/add-manual-passkey', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    resultDiv.innerHTML = '<p class="success">✅ ' + data.message + '</p>';
                    btn.textContent = 'Success!';
                    
                    // Redirect to login after 2 seconds
                    setTimeout(() => {
                        window.location.href = '/login';
                    }, 2000);
                } else {
                    throw new Error(data.error || 'Failed to add passkey');
                }
            } catch (error) {
                resultDiv.innerHTML = '<p class="error">❌ ' + error.message + '</p>';
                btn.disabled = false;
                btn.textContent = 'Add Manual Passkey';
            }
        }
    </script>
</body>
</html>
    `;
    
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(html);
  }

  if (req.method === 'POST') {
    try {
      const supabase = createClient();
      
      // Create a manual passkey entry
      const manualCredential = {
        credential_id: 'harsha_mac_touchid_manual_' + Date.now(),
        public_key: 'manual_dummy_key_' + Date.now(),
        counter: 0,
        device_name: 'Harsha Mac Touch ID (Manual Setup)'
      };
      
      // Insert the credential
      const { error: dbError } = await supabase
        .from('user_credentials')
        .insert(manualCredential);
      
      if (dbError) {
        console.error('Error storing manual credential:', dbError);
        return res.status(500).json({
          error: 'Failed to create manual passkey',
          details: dbError.message
        });
      }
      
      // Create session token
      const token = createSessionToken({
        userId: 'harsha-primary',
        credentialId: manualCredential.credential_id,
        deviceName: manualCredential.device_name,
      });

      // Set auth cookie
      setAuthCookie(res, token);

      return res.status(200).json({ 
        success: true,
        message: 'Manual passkey created successfully. You can now use Touch ID login.',
        credentialId: manualCredential.credential_id
      });
    } catch (error) {
      console.error('Manual passkey creation error:', error);
      return res.status(500).json({
        error: 'Failed to create manual passkey'
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}