import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, updateDoc } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Get environment variables directly from app.config.js extra section
const extra = Constants.expoConfig?.extra || {};

// Your Firebase config using environment variables from app.config.js
const firebaseConfig = {
  apiKey: extra.FIREBASE_API_KEY || "AIzaSyAyaItySsM_khVZGLYwgNXmppib0i73mFI",
  authDomain: extra.FIREBASE_AUTH_DOMAIN || "donateblood-2bf21.firebaseapp.com",
  projectId: extra.FIREBASE_PROJECT_ID || "donateblood-2bf21",
  storageBucket: extra.FIREBASE_STORAGE_BUCKET || "donateblood-2bf21.firebasestorage.app",
  messagingSenderId: extra.FIREBASE_MESSAGING_SENDER_ID || "936471207377",
  appId: extra.FIREBASE_APP_ID || "1:936471207377:web:569c2e0704c686909b54f0",
  measurementId: extra.FIREBASE_MEASUREMENT_ID || "G-JX31HFEZ44"
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

// Note: React Native Firebase handles offline persistence automatically
// No need for manual persistence configuration like in web apps

// Add these collection references
export const COLLECTIONS = {
  USERS: 'users',
  REQUESTS: 'requests',
  NOTIFICATIONS: 'notifications',
  DONATIONS: 'donations',
  STATS: 'stats',
  KYC_VERIFICATION: 'kyc_verification' // Added for KYC
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
