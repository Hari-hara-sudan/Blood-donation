const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// Send notification to specific user by user ID
exports.sendNotificationToUser = functions.https.onCall(async (data, context) => {
  try {
    const { userId, notification, dataPayload } = data;
    
    if (!userId) {
      throw new functions.https.HttpsError('invalid-argument', 'User ID is required');
    }

    // Get user's FCM token from Firestore
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found');
    }

    const userData = userDoc.data();
    const token = userData.fcmToken;

    if (!token) {
      throw new functions.https.HttpsError('failed-precondition', 'User has no FCM token');
    }

    const message = {
      token: token,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: dataPayload || {},
      android: {
        notification: {
          channelId: 'blood-requests',
          priority: 'high',
          defaultSound: true,
          defaultVibrateTimings: true,
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    const response = await admin.messaging().send(message);
    console.log('Successfully sent message:', response);
    
    // Save notification to user's notification history
    await admin.firestore().collection('users').doc(userId).collection('notifications').add({
      title: notification.title,
      body: notification.body,
      data: dataPayload || {},
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      messageId: response,
      status: 'sent'
    });

    return { success: true, messageId: response };
  } catch (error) {
    console.error('Error sending message:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send notification');
  }
});

// Send notification directly with FCM token
exports.sendNotificationWithToken = functions.https.onCall(async (data, context) => {
  try {
    const { token, notification, dataPayload } = data;
    
    if (!token) {
      throw new functions.https.HttpsError('invalid-argument', 'FCM token is required');
    }

    const message = {
      token: token,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: dataPayload || {},
      android: {
        notification: {
          channelId: 'blood-requests',
          priority: 'high',
          defaultSound: true,
          defaultVibrateTimings: true,
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    const response = await admin.messaging().send(message);
    console.log('Successfully sent message:', response);
    return { success: true, messageId: response };
  } catch (error) {
    console.error('Error sending message:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send notification');
  }
});

// Send notification to topic
exports.sendNotificationToTopic = functions.https.onCall(async (data, context) => {
  try {
    const { topic, notification, dataPayload } = data;
    
    if (!topic) {
      throw new functions.https.HttpsError('invalid-argument', 'Topic is required');
    }

    const message = {
      topic: topic,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: dataPayload || {},
      android: {
        notification: {
          channelId: 'blood-requests',
          priority: 'high',
          defaultSound: true,
          defaultVibrateTimings: true,
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    const response = await admin.messaging().send(message);
    console.log('Successfully sent message to topic:', response);
    return { success: true, messageId: response };
  } catch (error) {
    console.error('Error sending message to topic:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send notification to topic');
  }
});

// Function to save user FCM token
exports.saveUserFCMToken = functions.https.onCall(async (data, context) => {
  try {
    // Verify user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { token } = data;
    const userId = context.auth.uid;

    if (!token) {
      throw new functions.https.HttpsError('invalid-argument', 'FCM token is required');
    }

    // Save token to user document
    await admin.firestore().collection('users').doc(userId).set({
      fcmToken: token,
      lastTokenUpdate: admin.firestore.FieldValue.serverTimestamp(),
      userId: userId
    }, { merge: true });

    console.log(`FCM token updated for user: ${userId}`);
    return { success: true, userId: userId };
  } catch (error) {
    console.error('Error saving FCM token:', error);
    throw new functions.https.HttpsError('internal', 'Failed to save FCM token');
  }
});

// Send blood request notification to nearby donors
exports.sendBloodRequestNotification = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { bloodType, location, urgency, patientName, hospitalName } = data;

    // Get all users with matching blood type who can donate
    const compatibleBloodTypes = getCompatibleDonors(bloodType);
    const usersQuery = await admin.firestore().collection('users')
      .where('bloodType', 'in', compatibleBloodTypes)
      .where('isAvailableToDonate', '==', true)
      .get();

    const notifications = [];
    const batch = admin.firestore().batch();

    for (const userDoc of usersQuery.docs) {
      const userData = userDoc.data();
      if (userData.fcmToken) {
        const message = {
          token: userData.fcmToken,
          notification: {
            title: `${urgency.toUpperCase()} Blood Request - ${bloodType}`,
            body: `${patientName} needs ${bloodType} blood at ${hospitalName}, ${location}`,
          },
          data: {
            type: 'blood_request',
            bloodType: bloodType,
            location: location,
            urgency: urgency,
            patientName: patientName,
            hospitalName: hospitalName,
            requesterId: context.auth.uid
          },
          android: {
            notification: {
              channelId: 'blood-requests',
              priority: 'high',
              defaultSound: true,
              defaultVibrateTimings: true,
              color: '#DC143C'
            },
          },
        };

        try {
          const response = await admin.messaging().send(message);
          notifications.push({ userId: userDoc.id, success: true, messageId: response });
          
          // Save notification to user's history
          const notificationRef = admin.firestore().collection('users').doc(userDoc.id).collection('notifications').doc();
          batch.set(notificationRef, {
            title: message.notification.title,
            body: message.notification.body,
            data: message.data,
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            messageId: response,
            status: 'sent',
            type: 'blood_request'
          });

        } catch (error) {
          console.error(`Failed to send to user ${userDoc.id}:`, error);
          notifications.push({ userId: userDoc.id, success: false, error: error.message });
        }
      }
    }

    await batch.commit();
    
    console.log(`Sent ${notifications.filter(n => n.success).length} blood request notifications`);
    return { 
      success: true, 
      totalSent: notifications.filter(n => n.success).length,
      totalUsers: usersQuery.size,
      notifications: notifications
    };

  } catch (error) {
    console.error('Error sending blood request notifications:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send blood request notifications');
  }
});

// Helper function to get compatible blood donors
function getCompatibleDonors(requestedBloodType) {
  const compatibility = {
    'A+': ['A+', 'A-', 'O+', 'O-'],
    'A-': ['A-', 'O-'],
    'B+': ['B+', 'B-', 'O+', 'O-'],
    'B-': ['B-', 'O-'],
    'AB+': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], // Universal recipient
    'AB-': ['A-', 'B-', 'AB-', 'O-'],
    'O+': ['O+', 'O-'],
    'O-': ['O-'] // Universal donor can only receive O-
  };
  
  return compatibility[requestedBloodType] || [];
}

// Send notification when blood request is accepted
exports.sendBloodRequestAcceptedNotification = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { requesterId, donorName, donorPhone, estimatedArrival } = data;
    const donorId = context.auth.uid;

    // Get requester's FCM token
    const requesterDoc = await admin.firestore().collection('users').doc(requesterId).get();
    if (!requesterDoc.exists || !requesterDoc.data().fcmToken) {
      throw new functions.https.HttpsError('not-found', 'Requester not found or no FCM token');
    }

    const requesterData = requesterDoc.data();
    const message = {
      token: requesterData.fcmToken,
      notification: {
        title: 'Blood Donor Found! 🩸',
        body: `${donorName} is coming to help! ETA: ${estimatedArrival}`,
      },
      data: {
        type: 'request_accepted',
        donorId: donorId,
        donorName: donorName,
        donorPhone: donorPhone,
        estimatedArrival: estimatedArrival
      },
      android: {
        notification: {
          channelId: 'blood-requests',
          priority: 'high',
          defaultSound: true,
          defaultVibrateTimings: true,
          color: '#008000'
        },
      },
    };

    const response = await admin.messaging().send(message);
    
    // Save notification to requester's history
    await admin.firestore().collection('users').doc(requesterId).collection('notifications').add({
      title: message.notification.title,
      body: message.notification.body,
      data: message.data,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      messageId: response,
      status: 'sent',
      type: 'request_accepted'
    });

    return { success: true, messageId: response };

  } catch (error) {
    console.error('Error sending request accepted notification:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send notification');
  }
});

exports.cleanupExpiredRequests = functions.pubsub.schedule('every 5 minutes').onRun(async (context) => {
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();

  try {
    const snapshot = await db.collection('requests')
      .where('status', '==', 'active')
      .get();

    const batch = db.batch();
    let count = 0;

    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.expiresAt && data.expiresAt.toDate() < now.toDate()) {
        batch.delete(doc.ref);
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
      console.log(`Deleted ${count} expired requests`);
    }

    return null;
  } catch (error) {
    console.error('Error cleaning up expired requests:', error);
    return null;
  }
});