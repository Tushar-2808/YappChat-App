// app.js

// Import the necessary Firebase services from your config file
import { auth, db } from "./config.js"; // Adjust the path if config.js is not in the same directory

// Import other modular functions you need
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";

import {
    collection,
    doc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";


// Get DOM Elements
const loginView = document.getElementById('login-view');
const signupView = document.getElementById('signup-view');

const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');

const showSignupLink = document.getElementById('show-signup');
const showLoginLink = document.getElementById('show-login');

const messageArea = document.getElementById('message-area');

// --- Helper Functions ---
function showMessage(message, isError = true) {
    messageArea.textContent = message;
    messageArea.className = isError ? 'error' : 'success';
    setTimeout(() => {
        messageArea.textContent = '';
        messageArea.className = '';
    }, 5000);
}

function showLoginView() {
    loginView.style.display = 'block';
    signupView.style.display = 'none';
    messageArea.textContent = '';
    // Ensure we are on index.html
    if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
         window.location.href = 'index.html';
    }
}

function showSignupView() {
    loginView.style.display = 'none';
    signupView.style.display = 'block';
    messageArea.textContent = '';
}

// --- Event Listeners for View Toggling ---
showSignupLink.addEventListener('click', (e) => {
    e.preventDefault();
    showSignupView();
});

showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    showLoginView();
});

// --- Firebase Authentication Logic ---

// Signup
signupForm.addEventListener('submit', (e) => {
     e.preventDefault();
     const name = document.getElementById('signup-name').value;
     const email = document.getElementById('signup-email').value;
     const password = document.getElementById('signup-password').value;
     const dob = document.getElementById('signup-dob').value;
     const gender = document.getElementById('signup-gender').value;

     if (password.length < 6) {
         showMessage("Password should be at least 6 characters long.");
         return;
     }
     if (!name || !email || !password || !dob || !gender) {
         showMessage("Please fill in all fields.");
         return;
     }

console.log("Attempting to create user in Authentication...");

     createUserWithEmailAndPassword(auth, email, password)
         .then((userCredential) => {
         const user = userCredential.user;
         console.log("User created in Authentication:", user.uid, user.email);
         // User is automatically signed in here

         const usersCollectionRef = collection(db, 'users');
         const userDocRef = doc(usersCollectionRef, user.uid);

console.log("Attempting to save user data to Firestore for UID:", user.uid);

         // Attempt to save user data to Firestore
         // Return the promise from setDoc so the next .then() waits for it
         return setDoc(userDocRef, {
             name: name,
             email: email,
             dateOfBirth: dob,
             gender: gender,
             createdAt: serverTimestamp(),
             nameLower: name.toLowerCase()
             
         })
            .then(() => {
                 // This nested .then() only runs if setDoc's promise resolves successfully.
                 // This confirms the local write was successful.
                 console.log("Firestore setDoc successful.");
            })
            .catch((firestoreError) => {
                 // This nested .catch() catches errors specifically if setDoc's promise rejects.
                 console.error("Error during Firestore setDoc:", firestoreError.code, firestoreError.message);
                 // Re-throw the error so the main catch block also handles it
                 throw firestoreError;
            });
         })
         .then(() => {
            // This .then() block runs ONLY if both Authentication creation
            // AND the setDoc promise (including the nested .then/.catch) were successful.
            // This is the correct place to handle post-signup success actions like redirection.
            console.log("Signup process completed successfully. Redirecting to menu.");
             signupForm.reset();
             showMessage("Signup successful! Redirecting...", false);
             

            // *** The redirection is correctly placed here to happen after setDoc promise resolves successfully. ***
         window.location.href = 'menu.html';
         })
         .catch((error) => {
            // This outer catch block catches errors from createUserWithEmailAndPassword
            // OR any error re-thrown from the nested setDoc catch block.
             console.error("Signup process failed:", error.code, error.message);

            // Display a user-friendly message based on the error.
            let userMessage = "Signup failed. Please try again.";
            if (error.code) {
                if (error.code === 'auth/email-already-in-use') {
                    userMessage = 'The email address is already in use by another account.';
                } else if (error.code === 'auth/invalid-email') {
                    userMessage = 'The email address is not valid.';
                } else if (error.code === 'auth/operation-not-allowed') {
                     userMessage = 'Email/password sign up is not enabled. Contact administrator.';
                 } else if (error.code === 'auth/weak-password') {
                     userMessage = 'The password is too weak.';
                 } else if (error.code.startsWith('firestore/')) {
                     userMessage = 'Failed to save user data. Please try again or contact support.';
                     console.error("Firestore specific error during signup:", error.code, error.message);
                 } else {
                     userMessage = `Signup failed: ${error.message}`; // Fallback to generic message
                 }
             }
            showMessage(userMessage);
        });
});

// Login
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            console.log("User logged in:", user);
            showMessage("Login successful! Redirecting...", false);
            window.location.href = 'menu.html'; // Redirect to menu.html
        })
        .catch((error) => {
            console.error("Login Error:", error.code, error.message); // Log both code and message
let userMessage = "Login failed. Please check your email and password.";
if (error.code) {
if (error.code === 'auth/invalid-email' || error.code === 'auth/user-not-found') {
userMessage = 'Invalid email or password.';
} else if (error.code === 'auth/wrong-password') {
userMessage = 'Invalid email or password.';
} else if (error.code === 'auth/too-many-requests') {
userMessage = 'Too many login attempts. Please try again later.';
} else {
userMessage = `Login failed: ${error.message}`; // Fallback
}
}
            showMessage(userMessage);
        });
});

// --- Authentication State Observer ---
// Keep the observer here to handle cases where a user might navigate back to index.html while logged in
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Auth state changed on index.html: User is signed in", user);
        // Redirect to menu.html if on index.html and logged in
        if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
             //window.location.href = 'menu.html';
        }
    } else {
        console.log("Auth state changed on index.html: User is signed out");
         // Stay on index.html and show login form if user is signed out
         if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
              // This case should ideally not happen if navigation is handled correctly,
              // but as a fallback, could redirect back to login if somehow on another page
              // while signed out (e.g., manually typing the URL).
              // window.location.href = 'index.html';
              showLoginView(); // Ensure login view is shown
         } else {
              showLoginView(); // Ensure login view is shown
         }
    }
});

// Note: Initial view is handled by the onAuthStateChanged listener.