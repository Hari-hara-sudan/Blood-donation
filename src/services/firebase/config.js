import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, updateDoc } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAyaItySsM_khVZGLYwgNXmppib0i73mFI",
  authDomain: "donateblood-2bf21.firebaseapp.com",
  projectId: "donateblood-2bf21",
  storageBucket: "donateblood-2bf21.firebasestorage.app",
  messagingSenderId: "936471207377",
  appId: "1:936471207377:web:569c2e0704c686909b54f0",
  measurementId: "G-JX31HFEZ44"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth with AsyncStorage persistence
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

// Initialize Firestore (Database)
const db = getFirestore(app);

// Initialize Storage
const storage = getStorage(app);

// Enable offline data persistence
const enableOffline = async () => {
  try {
    await enableMultiTabIndexedDbPersistence(db);
  } catch (err) {
    if (err.code === 'failed-precondition') {
      // Multiple tabs open, persistence can only be enabled in one tab at a time
      console.warn('Multiple tabs open, persistence disabled');
    } else if (err.code === 'unimplemented') {
      // The current browser doesn't support persistence
      console.warn('Persistence not supported');
    }
  }
};

enableOffline();

// Add these collection references
export const COLLECTIONS = {
  USERS: 'users',
  REQUESTS: 'requests',
  NOTIFICATIONS: 'notifications',
  DONATIONS: 'donations',
  STATS: 'stats'
};

// Add request status constants
export const REQUEST_STATUS = {
  ACTIVE: 'active',
  ACCEPTED: 'accepted',
  COMPLETED: 'completed',
  EMERGENCY: 'emergency',
  CANCELLED: 'cancelled'
};

export { auth, db, storage };
