// requests.js

// Import the necessary Firebase services
import { auth, db } from "./config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs, documentId } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";


// Import friend request setup function
// The friendrequest.js file contains the onSnapshot listeners and display logic
import { setupFriendRequestListeners } from "./friendrequest.js";


// Get DOM Elements
const userNameDisplay = document.getElementById('user-name-display');
const themeSwitchButton = document.getElementById('theme-switch');
const logoutButton = document.getElementById('logout-button');
const menuNavButton = document.getElementById('menu-nav-button'); // Button to navigate back to menu

// Get the divs where requests will be displayed
const incomingRequestsListDiv = document.getElementById('incoming-requests-list');
const outgoingRequestsListDiv = document.getElementById('outgoing-requests-list');


let currentUser = null; // To store the currently logged-in user object


// Helper to fetch user names (needed by friendrequest.js display functions)
async function fetchUserNames(uids) {
    if (uids.length === 0) return {};
    const userData = {};
    const usersRef = collection(db, 'users');

     const q = query(usersRef, where(documentId(), 'in', uids));
     const querySnapshot = await getDocs(q);

     querySnapshot.forEach(doc => {
         const data = doc.data();
         userData[doc.id] = {
             name: data.name || 'Unknown User',
             email: data.email || 'Email Not Available'
         };
     });

    return userData;
}


// --- Authentication State Observer ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in
        currentUser = user;
        console.log("User is signed in on requests page:", currentUser.uid);

        // Fetch and display user's name in the navbar
        fetchAndDisplayUserData(currentUser.uid);

        // *** Setup friend request listeners and display on this page ***
        // Use the setupFriendRequestListeners from friendrequest.js
        setupFriendRequestListeners(currentUser.uid, incomingRequestsListDiv, outgoingRequestsListDiv, fetchUserNames);

    } else {
        // User is signed out
        currentUser = null;
        console.log("User is signed out. Redirecting to login.");
        // Redirect to index.html if not logged in
        window.location.href = 'index.html';
    }
});

// --- Fetch and Display User Data (for the navbar on this page) ---
async function fetchAndDisplayUserData(uid) {
    const userDocRef = doc(db, 'users', uid);
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
        const userData = docSnap.data();
        userNameDisplay.textContent = userData.name || 'User';
    } else {
        console.error("No user data found in Firestore for UID:", uid);
        userNameDisplay.textContent = 'User Data Missing';
    }
}


// --- Navigation and Logout ---

// Navigate back to the menu/chat page
menuNavButton.addEventListener('click', () => {
    window.location.href = 'menu.html';
});

// Theme Switching (Copy from menu.js)
themeSwitchButton.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    if (document.body.classList.contains('dark-mode')) {
        localStorage.setItem('theme', 'dark');
    } else {
        localStorage.setItem('theme', 'light');
    }
});

// Apply saved theme preference on page load
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
}


// Logout
logoutButton.addEventListener('click', () => {
    signOut(auth).then(() => {
        console.log("User signed out.");
        // onAuthStateChanged will handle the redirect
    }).catch((error) => {
        console.error("Logout Error:", error);
        alert("Error logging out: " + error.message);
    });
});