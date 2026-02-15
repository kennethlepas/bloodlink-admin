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

// Export for use in other modules
window.firebaseApp = firebase;
window.auth = auth;
window.database = database;
window.firestore = firestore;

console.log('Firebase initialized successfully');