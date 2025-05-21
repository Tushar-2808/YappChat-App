// menu.js

// Import the necessary Firebase services from your config file
import { auth, db } from "./config.js";

// Import other modular functions you need from Firebase
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";
import {
    doc, getDoc, collection, query, where, getDocs, orderBy, addDoc, serverTimestamp, onSnapshot,
    documentId // Needed for fetchUserNames
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";


// Import handleSendFriendRequest from friendrequest.js
import { handleSendFriendRequest } from "./friendrequest.js";


// Get DOM Elements
const userNameDisplay = document.getElementById('user-name-display');
const themeSwitchButton = document.getElementById('theme-switch');
const logoutButton = document.getElementById('logout-button');
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');
const searchResultsDiv = document.getElementById('search-results');
const friendsListDiv = document.getElementById('friends-list');

// Get references to chat-specific DOM elements within menu.html
const chatFriendNameDisplay = document.getElementById('chat-friend-name');
const chatMessagesListDiv = document.getElementById('chat-messages-list');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-message-button');

// Get reference to the requests navigation button (from menu.html navbar)
const requestsNavButton = document.getElementById('requests-nav-button');
// *** Get reference to the requests badge element ***
const requestsBadge = document.getElementById('requests-badge');


let currentUser = null;
let currentUserFriends = [];


// Variables for chat state
let currentChatId = null;
let unsubscribeMessages = null;


// Debounce variables for live search
let searchTimeout = null;
const DEBOUNCE_DELAY = 300;


// --- Functions at the top level ---

// Function to fetch and display user data
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

// Function to setup live search listener with debounce
function setupLiveSearch() {
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const searchTerm = searchInput.value.trim();
            performSearch(searchTerm);
        }, DEBOUNCE_DELAY);
    });

     searchButton.addEventListener('click', () => {
         const searchTerm = searchInput.value.trim();
         performSearch(searchTerm);
     });
}

// Function to perform the actual user search
async function performSearch(searchTerm) {
    searchResultsDiv.innerHTML = '<h3>Search Results</h3>';
    searchResultsDiv.classList.remove('list');
    searchResultsDiv.classList.add('list', 'no-hover');

    if (!currentUser) {
        searchResultsDiv.innerHTML += '<p class="empty-state">Please log in to search.</p>';
        return;
    }

    if (searchTerm.length < 1) {
        searchResultsDiv.innerHTML += '<p class="empty-state">Enter a name to search.</p>';
        return;
    }

    const lowerSearchTerm = searchTerm.toLowerCase();
    const usersRef = collection(db, 'users');
    const nameQuery = query(
        usersRef,
        where('nameLower', '>=', lowerSearchTerm),
        where('nameLower', '<=', lowerSearchTerm + '\uf8ff')
    );

    try {
        const querySnapshot = await getDocs(nameQuery);

        if (querySnapshot.empty) {
            searchResultsDiv.innerHTML += '<p class="empty-state">No users found with that name.</p>';
            return;
        }

        querySnapshot.forEach((doc) => {
             const userData = doc.data();
             const userId = doc.id;

             if (userId === currentUser.uid) {
                 return;
             }

             const resultItem = document.createElement('div');
             resultItem.classList.add('list-item', 'no-hover');

             const isFriend = currentUserFriends.includes(userId);

             let buttonHtml = '';
             let buttonClass = '';
             let buttonText = '';

             if (isFriend) {
                 buttonText = 'Chat';
                 buttonClass = 'chat-button';
                 buttonHtml = `<button class="${buttonClass}" data-uid="${userId}">${buttonText}</button>`;
             } else {
                 buttonText = 'Add Friend';
                 buttonClass = 'add-button';
                 buttonHtml = `<button class="${buttonClass}" data-uid="${userId}">Add Friend</button>`;
             }


             resultItem.innerHTML = `
                 <span>
                     <strong>${userData.name || 'User'}</strong><br>
                     <small>${userData.email || 'Email Not Available'}</small>
                 </span>
                 ${buttonHtml}
             `;
             searchResultsDiv.appendChild(resultItem);
        });

        searchResultsDiv.querySelectorAll('.add-button').forEach(button => {
            button.addEventListener('click', (event) => {
                handleSendFriendRequest(event, currentUser.uid, fetchUserNames);
            });
        });

        searchResultsDiv.querySelectorAll('.chat-button').forEach(button => {
            button.addEventListener('click', (event) => {
                const friendUid = event.target.dataset.uid;
                const friendName = event.target.closest('.list-item').querySelector('strong').textContent;
                console.log("Chat button clicked for friend UID:", friendUid);
                initiateChat(friendUid, friendName);
            });
        });

    } catch (error) {
        console.error("Error searching users:", error);
         searchResultsDiv.innerHTML += '<p class="empty-state">Error searching for users.</p>';
    }
}


// Function to set up realtime listeners (Friends and Friend Request Badge)
function setupRealtimeListeners(uid) {
    // Listener for Friends (using subcollection)
    const friendsCollectionRef = collection(db, 'users', uid, 'friends');
    onSnapshot(friendsCollectionRef, (snapshot) => {
        const friends = [];
        currentUserFriends = [];
        snapshot.forEach(doc => {
             const friendUid = doc.id;
             friends.push({ uid: friendUid, ...doc.data() });
             currentUserFriends.push(friendUid);
        });
        console.log("Current friends:", friends);
        console.log("Current user's friend UIDs:", currentUserFriends);
        displayFriends(friends);

         const currentSearchTerm = searchInput.value.trim();
         if(currentSearchTerm.length > 0) {
             performSearch(currentSearchTerm);
         }

    }, (error) => {
        console.error("Error listening to friends:", error);
    });

    // *** Listener for Incoming Friend Request Badge (on menu.js) ***
    const incomingRequestsBadgeQuery = query(collection(db, 'friendRequests'),
        where('to', '==', uid),
        where('status', '==', 'pending')
    );
    onSnapshot(incomingRequestsBadgeQuery, (snapshot) => {
        const pendingCount = snapshot.size;
        if (requestsBadge) { // Ensure badge element exists
            requestsBadge.textContent = pendingCount;
            if (pendingCount > 0) {
                requestsBadge.classList.remove('hidden');
            } else {
                requestsBadge.classList.add('hidden');
            }
        }
    }, (error) => {
        console.error("Error listening to incoming requests for badge:", error);
        if (requestsBadge) {
             requestsBadge.classList.add('hidden'); // Hide badge on error
        }
    });
}

// Helper to fetch multiple user names and emails by UID
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

// Function to display the current user's friends list
async function displayFriends(friends) {
    friendsListDiv.innerHTML = '';

    if (friends.length === 0) {
        friendsListDiv.innerHTML = '<p class="empty-state">No friends yet. Search to add some!</p>';
        return;
    }

    const friendUids = friends.map(f => f.uid);
    const friendData = await fetchUserNames(friendUids);

    friends.forEach(friend => {
        const friendItem = document.createElement('div');
        friendItem.classList.add('list-item');
        friendItem.dataset.friendUid = friend.uid;

         friendItem.innerHTML = `
             <span>
                 <strong>${friendData[friend.uid]?.name || 'User'}</strong><br>
                 <small>${friendData[friend.uid]?.email || 'Email Not Available'}</small>
             </span>
         `;
        friendItem.addEventListener('click', () => {
            console.log("Friend clicked:", friend.uid);
            initiateChat(friend.uid, friendData[friend.uid]?.name || 'User');
        });
        friendsListDiv.appendChild(friendItem);
    });
}


// --- Chat Functionality (Integrated into menu.js) ---

// Function to display messages in the chat area
function displayMessages(messageDocs, friendName) {
    chatMessagesListDiv.innerHTML = '';

    if (messageDocs.length === 0) {
        const welcomeMessageElement = document.createElement('div');
        welcomeMessageElement.classList.add('chat-welcome-message');
        welcomeMessageElement.innerHTML = `
            <p>Welcome to your new chat with <strong>${friendName}</strong>!</p>
            <p>Say hello!</p>
        `;
        chatMessagesListDiv.appendChild(welcomeMessageElement);
    }

    messageDocs.forEach(doc => {
        const message = doc.data();
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-message');

        if (message.senderId === currentUser.uid) {
            messageElement.classList.add('sent');
        } else {
            messageElement.classList.add('received');
        }

        if (message.text) {
            messageElement.innerHTML = `<p>${message.text}</p>`;
        } else {
             messageElement.innerHTML = `<p>[File message type not supported]</p>`;
        }

        if (message.timestamp) {
            const timestamp = message.timestamp.toDate();
            const timeString = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const timestampElement = document.createElement('span');
            timestampElement.classList.add('timestamp');
            timestampElement.textContent = timeString;
            messageElement.appendChild(timestampElement);
        }

        chatMessagesListDiv.appendChild(messageElement);
    });

    chatMessagesListDiv.scrollTop = chatMessagesListDiv.scrollHeight;
}

// Function to send a new message (text only)
async function sendMessage() {
    const messageText = messageInput.value.trim();

    if (messageText === '' || !currentChatId || !currentUser) {
        return;
    }

    const messagesCollectionRef = collection(db, 'chats', currentChatId, 'messages');

    const messageData = {
        senderId: currentUser.uid,
        text: messageText,
        timestamp: serverTimestamp()
    };

    try {
        await addDoc(messagesCollectionRef, messageData);
        console.log("Message sent successfully to chat:", currentChatId);
        messageInput.value = '';
    } catch (error) {
        console.error("Error sending message:", error);
    }
}


// Function to initiate a chat with a friend
async function initiateChat(friendUid, friendName) {
    if (!currentUser) {
        console.warn("User not logged in, cannot initiate chat.");
        return;
    }

    const userUids = [currentUser.uid, friendUid].sort();
    const chatId = userUids.join('_');

    if (currentChatId === chatId) {
        chatMessagesListDiv.scrollTop = chatMessagesListDiv.scrollHeight;
        return;
    }

    if (unsubscribeMessages) {
        unsubscribeMessages();
        unsubscribeMessages = null;
    }

    chatMessagesListDiv.innerHTML = '';
    chatFriendNameDisplay.textContent = `Chat with ${friendName}`;
    currentChatId = chatId;

    console.log(`Initiating chat with ${friendName} (Chat ID: ${chatId})`);

    const messagesCollectionRef = collection(db, 'chats', chatId, 'messages');
    const messagesQuery = query(messagesCollectionRef, orderBy('timestamp'));

    unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
        console.log("New message snapshot received for chat:", chatId);
        displayMessages(snapshot.docs, friendName);
    }, (error) => {
        console.error("Error listening to messages:", error);
        chatMessagesListDiv.innerHTML = '<p class="empty-state">Error loading messages.</p>';
    });

    messageInput.disabled = false;
    sendButton.disabled = false;
}


// --- Event Listeners for Chat Functionality ---
sendButton.addEventListener('click', () => sendMessage());

messageInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault();
        sendMessage();
    }
});


// --- Disable message input initially ---
messageInput.disabled = true;
sendButton.disabled = true;


// --- Authentication State Observer ---
// This listener is placed AFTER the function definitions
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        console.log("User is signed in on menu page:", currentUser.uid);

        fetchAndDisplayUserData(currentUser.uid);
        setupRealtimeListeners(currentUser.uid); // Sets up listeners for friends and badge
        setupLiveSearch();

        chatFriendNameDisplay.textContent = "Select a friend to chat";
        chatMessagesListDiv.innerHTML = '<p class="empty-state">No conversation selected.</p>';

    } else {
        currentUser = null;
        console.log("User is signed out. Redirecting to login.");
        window.location.href = 'index.html';
    }
});


// --- Other General Event Listeners ---

// Theme switch button listener
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

// Logout button listener
logoutButton.addEventListener('click', () => {
    signOut(auth).then(() => {
        console.log("User signed out.");
    }).catch((error) => {
        console.error("Logout Error:", error);
        alert("Error logging out: " + error.message);
    });
});

// Event Listener for Requests Navigation Button
// This button will navigate to the separate requests.html page
if (requestsNavButton) {
    requestsNavButton.addEventListener('click', () => {
        window.location.href = 'requests.html';
    });
} else {
    console.error("Requests navigation button not found in menu.html");
}