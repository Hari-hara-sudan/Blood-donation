const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

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