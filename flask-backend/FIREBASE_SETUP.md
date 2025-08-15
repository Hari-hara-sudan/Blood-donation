# Firebase Service Account Setup

## Step 1: Get Firebase Service Account Key

1. **Go to Firebase Console**: https://console.firebase.google.com/
2. **Select your project**: "donateblood-2bf21"
3. **Go to Project Settings**: Click gear icon → Project settings
4. **Navigate to Service Accounts tab**
5. **Click "Generate new private key"**
6. **Download the JSON file**
7. **Rename it to**: `firebase-service-account.json`
8. **Place it in**: `E:\BAPP\flask-backend\firebase-service-account.json`

## Step 2: File Structure Should Look Like:
```
flask-backend/
├── app.py
├── requirements.txt
├── SETUP.md
├── firebase-service-account.json  ← This file you just downloaded
└── README.md
```

## Step 3: Test Flask Backend
```bash
cd E:\BAPP\flask-backend
python app.py
```

## Important Notes:
- **Never commit** the `firebase-service-account.json` file to Git
- It contains sensitive credentials for your Firebase project
- The Flask app won't start without this file
- Make sure the JSON file is valid (downloaded correctly)

## Firestore Rules (Update in Firebase Console)
Go to Firestore Database → Rules and use:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /notifications/{document} {
      allow read, write: if request.auth != null;
    }
    match /topic_subscriptions/{document} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Once Setup is Complete:
1. Flask backend will run on: http://localhost:5000
2. Health check: http://localhost:5000/health
3. React Native app can send FCM tokens to Flask
4. Flask can send notifications back to devices
