from flask import Flask, request, jsonify
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, messaging, firestore
import json
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)  # Enable CORS for React Native requests

# Initialize Firebase Admin SDK
# You'll need to download your Firebase service account key
# Place it in the same directory as this file and name it 'firebase-service-account.json'
try:
    cred = credentials.Certificate('firebase-service-account.json')
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("Firebase Admin SDK initialized successfully")
except Exception as e:
    print(f"Error initializing Firebase: {e}")

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "timestamp": datetime.now().isoformat()})

@app.route('/save-fcm-token', methods=['POST'])
def save_fcm_token():
    """Save FCM token for a user"""
    try:
        data = request.get_json()
        user_id = data.get('userId')
        fcm_token = data.get('fcmToken')
        user_email = data.get('userEmail', '')
        
        if not user_id or not fcm_token:
            return jsonify({"error": "userId and fcmToken are required"}), 400
        
        # Save to Firestore
        user_ref = db.collection('users').document(user_id)
        user_ref.set({
            'fcmToken': fcm_token,
            'email': user_email,
            'lastTokenUpdate': firestore.SERVER_TIMESTAMP,
            'updatedAt': firestore.SERVER_TIMESTAMP
        }, merge=True)
        
        print(f"FCM token saved for user {user_id}")
        return jsonify({
            "success": True,
            "message": "FCM token saved successfully",
            "userId": user_id
        })
        
    except Exception as e:
        print(f"Error saving FCM token: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/send-notification', methods=['POST'])
def send_notification():
    """Send push notification to specific user"""
    try:
        data = request.get_json()
        user_id = data.get('userId')
        title = data.get('title')
        body = data.get('body')
        custom_data = data.get('data', {})
        
        if not user_id or not title or not body:
            return jsonify({"error": "userId, title, and body are required"}), 400
        
        # Get user's FCM token from Firestore
        user_ref = db.collection('users').document(user_id)
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            return jsonify({"error": "User not found"}), 404
        
        user_data = user_doc.to_dict()
        fcm_token = user_data.get('fcmToken')
        
        if not fcm_token:
            return jsonify({"error": "FCM token not found for user"}), 404
        
        # Create notification message
        message = messaging.Message(
            notification=messaging.Notification(
                title=title,
                body=body,
            ),
            data=custom_data,
            token=fcm_token,
        )
        
        # Send notification
        response = messaging.send(message)
        
        # Log notification sent
        db.collection('notifications').add({
            'userId': user_id,
            'title': title,
            'body': body,
            'data': custom_data,
            'fcmToken': fcm_token,
            'messageId': response,
            'sentAt': firestore.SERVER_TIMESTAMP,
            'status': 'sent'
        })
        
        print(f"Notification sent to user {user_id}: {response}")
        return jsonify({
            "success": True,
            "message": "Notification sent successfully",
            "messageId": response,
            "userId": user_id
        })
        
    except Exception as e:
        print(f"Error sending notification: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/send-notification-to-multiple', methods=['POST'])
def send_notification_to_multiple():
    """Send push notification to multiple users"""
    try:
        data = request.get_json()
        user_ids = data.get('userIds', [])
        title = data.get('title')
        body = data.get('body')
        custom_data = data.get('data', {})
        
        if not user_ids or not title or not body:
            return jsonify({"error": "userIds, title, and body are required"}), 400
        
        # Get FCM tokens for all users
        tokens = []
        valid_user_ids = []
        
        for user_id in user_ids:
            user_ref = db.collection('users').document(user_id)
            user_doc = user_ref.get()
            
            if user_doc.exists:
                user_data = user_doc.to_dict()
                fcm_token = user_data.get('fcmToken')
                if fcm_token:
                    tokens.append(fcm_token)
                    valid_user_ids.append(user_id)
        
        if not tokens:
            return jsonify({"error": "No valid FCM tokens found"}), 404
        
        # Create multicast message
        message = messaging.MulticastMessage(
            notification=messaging.Notification(
                title=title,
                body=body,
            ),
            data=custom_data,
            tokens=tokens,
        )
        
        # Send notification
        response = messaging.send_multicast(message)
        
        # Log notifications
        for i, user_id in enumerate(valid_user_ids):
            db.collection('notifications').add({
                'userId': user_id,
                'title': title,
                'body': body,
                'data': custom_data,
                'fcmToken': tokens[i],
                'sentAt': firestore.SERVER_TIMESTAMP,
                'status': 'sent',
                'batchId': response.responses[i].message_id if response.responses[i].success else None,
                'error': str(response.responses[i].exception) if not response.responses[i].success else None
            })
        
        print(f"Multicast notification sent: {response.success_count} successful, {response.failure_count} failed")
        return jsonify({
            "success": True,
            "message": "Multicast notification sent",
            "successCount": response.success_count,
            "failureCount": response.failure_count,
            "totalCount": len(tokens)
        })
        
    except Exception as e:
        print(f"Error sending multicast notification: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/send-notification-by-topic', methods=['POST'])
def send_notification_by_topic():
    """Send push notification to topic subscribers"""
    try:
        data = request.get_json()
        topic = data.get('topic')
        title = data.get('title')
        body = data.get('body')
        custom_data = data.get('data', {})
        
        if not topic or not title or not body:
            return jsonify({"error": "topic, title, and body are required"}), 400
        
        # Create topic message
        message = messaging.Message(
            notification=messaging.Notification(
                title=title,
                body=body,
            ),
            data=custom_data,
            topic=topic,
        )
        
        # Send notification
        response = messaging.send(message)
        
        # Log notification
        db.collection('notifications').add({
            'topic': topic,
            'title': title,
            'body': body,
            'data': custom_data,
            'messageId': response,
            'sentAt': firestore.SERVER_TIMESTAMP,
            'status': 'sent',
            'type': 'topic'
        })
        
        print(f"Topic notification sent to {topic}: {response}")
        return jsonify({
            "success": True,
            "message": "Topic notification sent successfully",
            "messageId": response,
            "topic": topic
        })
        
    except Exception as e:
        print(f"Error sending topic notification: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/get-user-notifications', methods=['GET'])
def get_user_notifications():
    """Get notification history for a user"""
    try:
        user_id = request.args.get('userId')
        limit = int(request.args.get('limit', 50))
        
        if not user_id:
            return jsonify({"error": "userId is required"}), 400
        
        # Get notifications from Firestore
        notifications_ref = db.collection('notifications')
        query = notifications_ref.where('userId', '==', user_id).order_by('sentAt', direction=firestore.Query.DESCENDING).limit(limit)
        
        notifications = []
        for doc in query.stream():
            notification_data = doc.to_dict()
            notification_data['id'] = doc.id
            # Convert timestamp to string
            if 'sentAt' in notification_data and notification_data['sentAt']:
                notification_data['sentAt'] = notification_data['sentAt'].isoformat()
            notifications.append(notification_data)
        
        return jsonify({
            "success": True,
            "notifications": notifications,
            "count": len(notifications)
        })
        
    except Exception as e:
        print(f"Error getting notifications: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/blood-request-notification', methods=['POST'])
def send_blood_request_notification():
    """Send blood request notification to nearby donors"""
    try:
        data = request.get_json()
        blood_type = data.get('bloodType')
        location = data.get('location')
        urgency = data.get('urgency', 'normal')
        requester_name = data.get('requesterName', 'Someone')
        hospital_name = data.get('hospitalName', '')
        
        if not blood_type or not location:
            return jsonify({"error": "bloodType and location are required"}), 400
        
        # Create notification content
        title = f"🩸 Urgent: {blood_type} Blood Needed!"
        body = f"{requester_name} needs {blood_type} blood in {location}"
        if hospital_name:
            body += f" at {hospital_name}"
        
        # Send to blood type topic
        topic = f"blood_type_{blood_type.lower().replace('+', 'pos').replace('-', 'neg')}"
        
        message = messaging.Message(
            notification=messaging.Notification(
                title=title,
                body=body,
            ),
            data={
                'type': 'blood_request',
                'bloodType': blood_type,
                'location': location,
                'urgency': urgency,
                'requesterName': requester_name,
                'hospitalName': hospital_name,
                'timestamp': str(datetime.now().timestamp())
            },
            topic=topic,
        )
        
        # Send notification
        response = messaging.send(message)
        
        # Log notification
        db.collection('notifications').add({
            'type': 'blood_request',
            'topic': topic,
            'title': title,
            'body': body,
            'bloodType': blood_type,
            'location': location,
            'urgency': urgency,
            'requesterName': requester_name,
            'hospitalName': hospital_name,
            'messageId': response,
            'sentAt': firestore.SERVER_TIMESTAMP,
            'status': 'sent'
        })
        
        print(f"Blood request notification sent to topic {topic}: {response}")
        return jsonify({
            "success": True,
            "message": "Blood request notification sent successfully",
            "messageId": response,
            "topic": topic
        })
        
    except Exception as e:
        print(f"Error sending blood request notification: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/subscribe-to-topic', methods=['POST'])
def subscribe_to_topic():
    """Subscribe user to FCM topic"""
    try:
        data = request.get_json()
        user_id = data.get('userId')
        topic = data.get('topic')
        
        if not user_id or not topic:
            return jsonify({"error": "userId and topic are required"}), 400
        
        # Get user's FCM token
        user_ref = db.collection('users').document(user_id)
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            return jsonify({"error": "User not found"}), 404
        
        user_data = user_doc.to_dict()
        fcm_token = user_data.get('fcmToken')
        
        if not fcm_token:
            return jsonify({"error": "FCM token not found for user"}), 404
        
        # Subscribe to topic
        response = messaging.subscribe_to_topic([fcm_token], topic)
        
        # Log subscription
        db.collection('topic_subscriptions').add({
            'userId': user_id,
            'topic': topic,
            'fcmToken': fcm_token,
            'subscribedAt': firestore.SERVER_TIMESTAMP,
            'status': 'subscribed'
        })
        
        print(f"User {user_id} subscribed to topic {topic}")
        return jsonify({
            "success": True,
            "message": f"Successfully subscribed to topic {topic}",
            "topic": topic,
            "userId": user_id
        })
        
    except Exception as e:
        print(f"Error subscribing to topic: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/unsubscribe-from-topic', methods=['POST'])
def unsubscribe_from_topic():
    """Unsubscribe user from FCM topic"""
    try:
        data = request.get_json()
        user_id = data.get('userId')
        topic = data.get('topic')
        
        if not user_id or not topic:
            return jsonify({"error": "userId and topic are required"}), 400
        
        # Get user's FCM token
        user_ref = db.collection('users').document(user_id)
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            return jsonify({"error": "User not found"}), 404
        
        user_data = user_doc.to_dict()
        fcm_token = user_data.get('fcmToken')
        
        if not fcm_token:
            return jsonify({"error": "FCM token not found for user"}), 404
        
        # Unsubscribe from topic
        response = messaging.unsubscribe_from_topic([fcm_token], topic)
        
        # Update subscription status
        subscriptions_ref = db.collection('topic_subscriptions')
        query = subscriptions_ref.where('userId', '==', user_id).where('topic', '==', topic)
        
        for doc in query.stream():
            doc.reference.update({
                'status': 'unsubscribed',
                'unsubscribedAt': firestore.SERVER_TIMESTAMP
            })
        
        print(f"User {user_id} unsubscribed from topic {topic}")
        return jsonify({
            "success": True,
            "message": f"Successfully unsubscribed from topic {topic}",
            "topic": topic,
            "userId": user_id
        })
        
    except Exception as e:
        print(f"Error unsubscribing from topic: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("Starting Flask notification server...")
    print("Make sure you have firebase-service-account.json in the same directory")
    app.run(host='0.0.0.0', port=5000, debug=True)
