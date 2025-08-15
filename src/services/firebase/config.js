import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, updateDoc } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Get environment variables directly from app.config.js extra section
const extra = Constants.expoConfig?.extra || {};

// Firebase config (must match the android/app/google-services.json values for consistency)
// NOTE: Previously the apiKey here differed from the one inside google-services.json which can
// sometimes cause unexpected auth/network issues in release builds. Keep them in sync.
const firebaseConfig = {
  apiKey: "AIzaSyCsjq6wVk_5MY8LDXQjEZezkbbo6EBs05U", // from google-services.json current_key
  authDomain: "donateblood-2bf21.firebaseapp.com",
  projectId: "donateblood-2bf21",
  storageBucket: "donateblood-2bf21.firebasestorage.app",
  messagingSenderId: "936471207377",
  appId: "1:936471207377:web:569c2e0704c686909b54f0",
  measurementId: "G-JX31HFEZ44"
};

// Initialize Firebase (guard against re-initialization in fast refresh scenarios)
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  console.log('[Firebase] Initialized app with projectId:', firebaseConfig.projectId);
} else {
  app = getApps()[0];
  console.log('[Firebase] Reusing existing app instance');
}

// Initialize Auth with AsyncStorage persistence
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
} catch (error) {
  // If auth is already initialized, get the existing instance
  if (error.code === 'auth/already-initialized') {
    auth = getAuth(app);
    console.log('[Firebase] Reusing existing auth instance');
  } else {
    throw error;
  }
}

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
