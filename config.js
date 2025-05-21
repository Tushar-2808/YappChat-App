// config.js

// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-storage.js"; // *** ADD THIS IMPORT ***
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-analytics.js"; // Optional: Include if you use Analytics

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCk5DGaixkPPxbruhs6SbaFmWRrM0EdcH8",
  authDomain: "yappchat-8af7b.firebaseapp.com",
  projectId: "yappchat-8af7b",
  storageBucket: "yappchat-8af7b.firebasestorage.app",
  messagingSenderId: "690716188229",
  appId: "1:690716188229:web:e211d887a4ee37554b0d2c",
  measurementId: "G-MYPMPMC9Y7" // Optional
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services and EXPORT them
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app); // *** ADD THIS LINE to initialize and EXPORT storage ***
export const analytics = getAnalytics(app); // Optional: Export analytics if initialized