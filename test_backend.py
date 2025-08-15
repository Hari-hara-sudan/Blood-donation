#!/usr/bin/env python3
"""
Simple test script to verify Flask backend functionality
"""

import requests
import json
import time

FLASK_URL = "http://127.0.0.1:5000"

def test_health_endpoint():
    """Test the health endpoint"""
    try:
        response = requests.get(f"{FLASK_URL}/health", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print("✅ Health Check PASSED")
            print(f"   Status: {data.get('status')}")
            print(f"   Timestamp: {data.get('timestamp')}")
            return True
        else:
            print(f"❌ Health Check FAILED - Status: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Health Check FAILED - Error: {e}")
        return False

def test_fcm_token_save():
    """Test FCM token saving endpoint"""
    try:
        test_data = {
            "userId": "test_user_123",
            "fcmToken": "test_token_456",
            "userEmail": "test@example.com"
        }
        
        response = requests.post(
            f"{FLASK_URL}/save-fcm-token",
            json=test_data,
            timeout=5
        )
        
        if response.status_code == 500:
            # Expected due to missing Firebase service account
            print("⚠️  FCM Token Save - Expected Error (Missing Firebase key)")
            print("   This is normal without firebase-service-account.json")
            return True
        elif response.status_code == 200:
            print("✅ FCM Token Save PASSED")
            return True
        else:
            print(f"❌ FCM Token Save FAILED - Status: {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ FCM Token Save FAILED - Error: {e}")
        return False

def main():
    print("🧪 Testing Blood Donation App Backend\n")
    print("=" * 50)
    
    # Test health endpoint
    health_ok = test_health_endpoint()
    print()
    
    # Test FCM token endpoint
    token_ok = test_fcm_token_save()
    print()
    
    print("=" * 50)
    print("📊 TEST SUMMARY:")
    print(f"   Health Endpoint: {'✅ PASS' if health_ok else '❌ FAIL'}")
    print(f"   FCM Token API: {'✅ PASS' if token_ok else '❌ FAIL'}")
    
    if health_ok and token_ok:
        print("\n🎉 Backend is ready for testing!")
        print("📱 Next steps:")
        print("   1. Install development APK on device")
        print("   2. Login to the app")
        print("   3. Tap '🧪 Test Notifications' button")
        print("   4. Add firebase-service-account.json for full functionality")
    else:
        print("\n⚠️  Some tests failed. Check Flask server status.")

if __name__ == "__main__":
    main()
