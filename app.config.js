import 'dotenv/config';

export default {
  expo: {
    name: "BAPP",
    slug: "BAPP",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true,
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "This app needs access to location to find nearby blood requests.",
        NSLocationAlwaysUsageDescription: "This app needs access to location to find nearby blood requests.",
        UIBackgroundModes: [
          "location"
        ]
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      permissions: [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION"
      ],
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY || "AIzaSyBlB34GJNGbRexESR9zILOTx7s5mcIPhkE"
        }
      },
      package: "com.harry_r.BAPP"
    },
    web: {
      favicon: "./assets/favicon.png",
      bundler: "metro"
    },
    plugins: [
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "Allow BAPP to use your location to find nearby blood requests."
        }
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/notification-icon.png",
          color: "#ffffff",
          sounds: [
            "./assets/notification-sound.wav"
          ]
        }
      ]
    ],
    extra: {
      // EAS project configuration
      eas: {
        projectId: "f1c79f40-ee85-458b-ab00-e770a3e3ac6d"
      },
      // Make environment variables available to the app
      GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY || "AIzaSyBlB34GJNGbRexESR9zILOTx7s5mcIPhkE",
      FIREBASE_API_KEY: process.env.FIREBASE_API_KEY || "AIzaSyAyaItySsM_khVZGLYwgNXmppib0i73mFI",
      FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN || "donateblood-2bf21.firebaseapp.com",
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || "donateblood-2bf21",
      FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET || "donateblood-2bf21.firebasestorage.app",
      FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID || "936471207377",
      FIREBASE_APP_ID: process.env.FIREBASE_APP_ID || "1:936471207377:web:569c2e0704c686909b54f0",
      FIREBASE_MEASUREMENT_ID: process.env.FIREBASE_MEASUREMENT_ID || "G-JX31HFEZ44"
    }
  }
};
