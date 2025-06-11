#!/usr/bin/env python3
"""
Start the backend server with proper error handling
"""

import sys
import signal
import time
from app import app

def signal_handler(sig, frame):
    """Handle Ctrl+C gracefully"""
    print('\n🛑 Shutting down backend server...')
    sys.exit(0)

def start_backend():
    """Start the Flask backend server"""
    
    print("🚀 Starting Resume Builder Backend")
    print("=" * 40)
    print("📝 Frontend: http://localhost:5173")
    print("🔧 Backend API: http://localhost:5001")
    print("❤️  Health Check: http://localhost:5001/health")
    print()
    print("Press Ctrl+C to stop the server")
    print("=" * 40)
    
    # Register signal handler for graceful shutdown
    signal.signal(signal.SIGINT, signal_handler)
    
    try:
        # Start the Flask app
        app.run(
            host='0.0.0.0',
            port=5001,
            debug=True,
            use_reloader=True
        )
    except KeyboardInterrupt:
        print('\n🛑 Server stopped by user')
    except Exception as e:
        print(f'\n❌ Server error: {e}')
        sys.exit(1)

if __name__ == '__main__':
    start_backend()