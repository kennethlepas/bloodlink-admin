// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBmbgEyTbdFFFwpxaLYdX3rRwvoWSL1wQ0",
  authDomain: "bloodlink-app-b9297.firebaseapp.com",
  databaseURL: "https://bloodlink-app-b9297-default-rtdb.firebaseio.com",
  projectId: "bloodlink-app-b9297",
  storageBucket: "bloodlink-app-b9297.firebasestorage.app",
  messagingSenderId: "492859346824",
  appId: "1:492859346824:web:77dea9c3e8c6eb1376f43d",
  measurementId: "G-B55EDLVHF2"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Firebase Services
const auth = firebase.auth();
const database = firebase.database();
const firestore = firebase.firestore();

// Enable Offline Persistence with modern settings if supported
// Note: enablePersistence() is deprecated in newer v9+ versions in favor of FirestoreSettings.cache
// but remains the standard for the compat layer.
try {
  firestore.enablePersistence({ synchronizeTabs: true })
    .catch((err) => {
      if (err.code == 'failed-precondition') {
        console.warn('Firestore Persistence failed: Multiple tabs open');
      } else if (err.code == 'unimplemented') {
        console.warn('Firestore Persistence is not available in this browser');
      }
    });
} catch (e) {
  console.warn('Could not initialize Firestore persistence:', e);
}

// Export for use in other modules
window.firebaseConfig = firebaseConfig;
window.firebaseApp = firebase;
window.auth = auth;
window.database = database;
window.firestore = firestore;

console.log('Firebase initialized successfully');