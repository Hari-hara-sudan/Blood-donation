# Flask Push Notification Backend Setup

## Prerequisites
1. **Python 3.8+** installed
2. **Firebase Project** with Cloud Messaging enabled
3. **Firebase Service Account Key** (JSON file)

## Setup Instructions

### 1. Firebase Service Account Key
1. Go to **Firebase Console** → **Project Settings** → **Service Accounts**
2. Click **"Generate new private key"**
3. Download the JSON file
4. Rename it to `firebase-service-account.json`
5. Place it in the `flask-backend` directory

### 2. Install Python Dependencies
```bash
cd flask-backend
pip install -r requirements.txt
```

### 3. Update Flask URL in React Native
In `src/services/NotificationSender.js`, update the Flask URL:

```javascript
// For Android Emulator
const FLASK_BASE_URL = 'http://10.0.2.2:5000';

// For Physical Device (replace with your computer's IP)
const FLASK_BASE_URL = 'http://192.168.1.100:5000';

// For iOS Simulator
const FLASK_BASE_URL = 'http://localhost:5000';
```

### 4. Run Flask Server
```bash
cd flask-backend
python app.py
```

## API Endpoints

### Core Endpoints
- **POST** `/save-fcm-token` - Save user's FCM token
- **POST** `/send-notification` - Send notification to specific user
- **POST** `/send-notification-to-multiple` - Send to multiple users
- **POST** `/send-notification-by-topic` - Send to topic subscribers
- **GET** `/get-user-notifications` - Get user's notification history
- **GET** `/health` - Health check

### Blood Donation Specific
- **POST** `/blood-request-notification` - Send blood request to donors
- **POST** `/subscribe-to-topic` - Subscribe user to topic
- **POST** `/unsubscribe-from-topic` - Unsubscribe user from topic

## Example Usage

### Save FCM Token
```javascript
import { saveFCMTokenToBackend } from '../services/NotificationSender';

await saveFCMTokenToBackend(userId, fcmToken, userEmail);
```

### Send Notification
```javascript
import { sendNotificationToUser } from '../services/NotificationSender';

await sendNotificationToUser(
  userId, 
  'Blood Request', 
  'O+ blood needed urgently!',
  { type: 'blood_request', location: 'Hospital ABC' }
);
```

### Send Blood Request
```javascript
import { sendBloodRequestNotification } from '../services/NotificationSender';

await sendBloodRequestNotification(
  'O+',              // bloodType
  'Downtown',        // location  
  'John Doe',        // requesterName
  'City Hospital',   // hospitalName
  'urgent'           // urgency
);
```

## Testing
1. Start Flask server: `python app.py`
2. Build and install React Native app with development build
3. Login to the app
4. Check Flask console logs for FCM token saving
5. Use the demo screen to test notifications

## Architecture Flow
1. **React Native App** → Generates FCM token
2. **FCM Token** → Saved to both Firestore and Flask backend
3. **Flask Backend** → Uses Firebase Admin SDK to send notifications
4. **Firebase Cloud Messaging** → Delivers notifications to devices
5. **React Native App** → Receives and handles notifications

## Firestore Collections Created
- `users` - User profiles with FCM tokens
- `notifications` - Notification history
- `topic_subscriptions` - Topic subscription tracking
