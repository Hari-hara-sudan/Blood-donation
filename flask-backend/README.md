# Firebase Service Account Setup

## Steps to get Firebase Service Account Key:

1. **Go to Firebase Console**: https://console.firebase.google.com/
2. **Select your project**: donateblood-2bf21
3. **Go to Project Settings**: Click gear icon → Project settings
4. **Service Accounts tab**: Click on "Service accounts"
5. **Generate new private key**: Click "Generate new private key"
6. **Download the JSON file**: Save it as `firebase-service-account.json`
7. **Place in backend folder**: Move the file to `E:\BAPP\flask-backend\firebase-service-account.json`

## Security Note:
- Never commit this file to version control
- Add `firebase-service-account.json` to your .gitignore file
- This file contains sensitive credentials

## Flask Backend Setup:

1. Install Python dependencies:
```bash
cd E:\BAPP\flask-backend
pip install -r requirements.txt
```

2. Run the Flask server:
```bash
python app.py
```

The server will start on http://localhost:5000

## API Endpoints:

- POST `/save-fcm-token` - Save user's FCM token
- POST `/send-notification` - Send notification to specific user
- POST `/send-notification-to-multiple` - Send to multiple users
- POST `/send-notification-by-topic` - Send to topic subscribers
- POST `/blood-request-notification` - Send blood request alerts
- GET `/get-user-notifications` - Get user's notification history
- GET `/health` - Health check endpoint
