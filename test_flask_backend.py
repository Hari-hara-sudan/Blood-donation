import requests
import json

# Test Flask backend endpoints
BASE_URL = "http://localhost:5000"

def test_health():
    try:
        response = requests.get(f"{BASE_URL}/health")
        print(f"Health endpoint: {response.status_code}")
        print(f"Response: {response.json()}")
        return True
    except Exception as e:
        print(f"Health endpoint failed: {e}")
        return False

def test_save_fcm_token():
    try:
        data = {
            "user_id": "test_user_123",
            "fcm_token": "test_fcm_token_xyz",
            "timestamp": "2024-01-01T00:00:00Z"
        }
        response = requests.post(f"{BASE_URL}/save-fcm-token", json=data)
        print(f"Save FCM token: {response.status_code}")
        print(f"Response: {response.json()}")
        return True
    except Exception as e:
        print(f"Save FCM token failed: {e}")
        return False

def test_send_notification():
    try:
        data = {
            "user_id": "test_user_123",
            "title": "Test Notification",
            "body": "This is a test notification",
            "data": {"type": "test"}
        }
        response = requests.post(f"{BASE_URL}/send-notification", json=data)
        print(f"Send notification: {response.status_code}")
        print(f"Response: {response.json()}")
        return True
    except Exception as e:
        print(f"Send notification failed: {e}")
        return False

if __name__ == "__main__":
    print("Testing Flask Backend Endpoints...")
    print("=" * 50)
    
    print("\n1. Testing Health Endpoint:")
    test_health()
    
    print("\n2. Testing Save FCM Token:")
    test_save_fcm_token()
    
    print("\n3. Testing Send Notification:")
    test_send_notification()
    
    print("\n" + "=" * 50)
    print("Backend test completed!")
