#!/usr/bin/env python3
"""Test API endpoints for unified email service"""

import requests
import json

BASE_URL = "http://localhost:5001"

def test_health_endpoint():
    """Test health check endpoint"""
    print("🏥 Testing health endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/health")
        data = response.json()
        print(f"✅ Health check: {data}")
        return True
    except Exception as e:
        print(f"❌ Health check failed: {e}")
        return False

def test_email_activities():
    """Test email activities endpoint"""
    print("\n📧 Testing email activities endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/api/emails/activities?days_back=14&limit=10")
        data = response.json()
        
        if data.get('success'):
            print(f"✅ Email activities: {data.get('message', 'Success')}")
            dashboard_data = data.get('data', {})
            print(f"   - Activities: {len(dashboard_data.get('email_activities', []))}")
            print(f"   - Attention items: {len(dashboard_data.get('attention_items', []))}")
            print(f"   - Quick updates: {len(dashboard_data.get('quick_updates', []))}")
            print(f"   - Upcoming events: {len(dashboard_data.get('upcoming_events', []))}")
            return True
        else:
            print(f"❌ Email activities failed: {data.get('error')}")
            return False
    except Exception as e:
        print(f"❌ Email activities error: {e}")
        return False

def test_email_sync():
    """Test email sync endpoint"""
    print("\n🔄 Testing email sync endpoint...")
    try:
        payload = {
            "days_back": 1,
            "max_results": 5,
            "force_reprocess": False
        }
        response = requests.post(f"{BASE_URL}/api/emails/sync", json=payload)
        data = response.json()
        
        if data.get('success'):
            print(f"✅ Email sync: {data.get('message', 'Success')}")
            summary = data.get('summary', {})
            print(f"   - Total emails: {summary.get('total_emails', 0)}")
            print(f"   - Processed: {summary.get('processed_count', 0)}")
            print(f"   - Companies created: {summary.get('companies_created', 0)}")
            print(f"   - Contacts created: {summary.get('contacts_created', 0)}")
            print(f"   - Jobs created: {summary.get('jobs_created', 0)}")
            return True
        else:
            print(f"❌ Email sync failed: {data.get('error')}")
            return False
    except Exception as e:
        print(f"❌ Email sync error: {e}")
        return False

def test_background_sync():
    """Test background sync endpoint"""
    print("\n🔄 Testing background sync endpoint...")
    try:
        payload = {
            "days_back": 1,
            "max_results": 10
        }
        response = requests.post(f"{BASE_URL}/api/emails/background-sync", json=payload)
        data = response.json()
        
        if data.get('success'):
            print(f"✅ Background sync: {data.get('message', 'Success')}")
            print(f"   - New emails: {data.get('new_emails_count', 0)}")
            print(f"   - Processed: {data.get('processed_count', 0)}")
            return True
        else:
            print(f"❌ Background sync failed: {data.get('error')}")
            return False
    except Exception as e:
        print(f"❌ Background sync error: {e}")
        return False

if __name__ == "__main__":
    print("🧪 TESTING API ENDPOINTS")
    print("=" * 50)
    print(f"Testing server at: {BASE_URL}")
    print("Make sure the Flask server is running!")
    print()
    
    # Run tests
    tests_passed = 0
    total_tests = 4
    
    if test_health_endpoint():
        tests_passed += 1
    
    if test_email_activities():
        tests_passed += 1
        
    if test_email_sync():
        tests_passed += 1
        
    if test_background_sync():
        tests_passed += 1
    
    print("\n" + "=" * 50)
    print(f"🏁 Tests completed: {tests_passed}/{total_tests} passed")
    
    if tests_passed == total_tests:
        print("🎉 All tests passed!")
    else:
        print("⚠️ Some tests failed. Check the logs above.")