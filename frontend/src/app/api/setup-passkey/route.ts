import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Setup Passkey - ResumeForge</title>
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
        }
        h1 { 
            color: #1e293b; 
            margin-bottom: 8px;
            font-size: 24px;
            font-weight: 600;
        }
        .subtitle {
            color: #64748b;
            margin-bottom: 32px;
            font-size: 14px;
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
            margin-bottom: 16px;
        }
        button:hover { background: #2563eb; }
        button:disabled { 
            background: #94a3b8; 
            cursor: not-allowed; 
        }
        .log { 
            background: #f1f5f9; 
            padding: 12px; 
            margin: 8px 0; 
            border-radius: 6px; 
            font-family: Monaco, monospace; 
            font-size: 12px;
            border-left: 4px solid #e2e8f0;
        }
        .success { border-left-color: #10b981; background: #ecfdf5; color: #047857; }
        .error { border-left-color: #ef4444; background: #fef2f2; color: #dc2626; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Setup Your Passkey</h1>
        <p class="subtitle">Register your passkey to enable Touch ID/Face ID login</p>
        
        <button onclick="registerPasskey()" id="registerBtn">
            🔐 Register Passkey
        </button>
        
        <div id="log"></div>
    </div>

    <script type="module">
        import { startRegistration } from 'https://cdn.jsdelivr.net/npm/@simplewebauthn/browser@13.1.0/+esm'
        
        function log(message, type = 'info') {
            const logDiv = document.getElementById('log');
            const className = type === 'error' ? 'log error' : type === 'success' ? 'log success' : 'log';
            logDiv.innerHTML += '<div class="' + className + '">' + message + '</div>';
            console.log(message);
        }
        
        window.registerPasskey = async function() {
            const btn = document.getElementById('registerBtn');
            btn.disabled = true;
            btn.textContent = 'Registering...';
            
            try {
                log('🔑 Starting passkey registration...');
                
                // Get registration options
                const optionsResponse = await fetch('/api/register-passkey');
                if (!optionsResponse.ok) {
                    throw new Error('Failed to get registration options');
                }
                
                const options = await optionsResponse.json();
                log('✅ Got registration options');
                console.log('Registration options:', options);
                
                // Start registration - pass options directly
                log('👆 Please approve the passkey creation on your device...');
                const attResp = await startRegistration(options);
                log('✅ Passkey created successfully');
                
                // Send to server for verification
                const verificationResponse = await fetch('/api/register-passkey', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ credential: attResp }),
                });
                
                if (!verificationResponse.ok) {
                    const error = await verificationResponse.json();
                    throw new Error(error.error || 'Registration failed');
                }
                
                const result = await verificationResponse.json();
                log('🎉 Passkey registration successful!', 'success');
                log('✅ You can now use Touch ID/Face ID to login', 'success');
                
                btn.textContent = '✅ Registration Complete';
                
                // Redirect to login after 2 seconds
                setTimeout(() => {
                    window.location.href = '/login';
                }, 2000);
                
            } catch (error) {
                log('❌ Registration failed: ' + error.message, 'error');
                btn.disabled = false;
                btn.textContent = '🔐 Register Passkey';
            }
        };
    </script>
</body>
</html>
  `;
  
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}