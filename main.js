// menu.js

// Import the necessary Firebase services from your config file
import { auth, db } from "./config.js";

// Import other modular functions you need from Firebase
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";
import {
    doc, getDoc, collection, query, where, getDocs, orderBy, addDoc, serverTimestamp,
    documentId, onSnapshot
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";


// Import handleSendFriendRequest from friendrequest.js
import { handleSendFriendRequest } from "./friendrequest.js";


// Get DOM Elements (These need to be inside DOMContentLoaded or accessed after the DOM is ready)
let userNameDisplay;
let themeSwitchButton;
let logoutButton;
let searchInput;
let searchButton;
let searchResultsDiv;
let friendsListDiv; // This is the sidebar friends list

// Get references to chat-specific DOM elements within menu.html
let chatFriendNameDisplay;
let chatMessagesListDiv;
let messageInput;
let sendButton;

// Get reference to the requests navigation button (from menu.html navbar)
let requestsNavButton;

// Get reference to the requests badge element
let requestsBadge;

// Get reference to the mobile menu toggle button and the mobile Friends button
let mobileMenuToggle;
let friendsNavButton; // The Friends button in navbar-left


let currentUser = null;
let currentUserFriends = [];


let currentChatId = null;
let unsubscribeMessages = null;


let searchTimeout = null;
const DEBOUNCE_DELAY = 300;


// --- Functions ---

// Function to show/hide the sidebar on mobile
function toggleSidebar() {
    console.log('Toggle sidebar clicked!');
    const sidebar = document.querySelector('.sidebar');
    // const navbarRight = document.querySelector('.navbar-right'); // No longer toggled by this
    
    if (sidebar) {
        sidebar.classList.toggle('active');
    }
    
    // Removed logic to toggle navbar-right visibility here
}

// Function to populate friends list in mobile menu
async function populateMobileFriendsList() {
    const navbarRight = document.querySelector('.navbar-right');
    if (!navbarRight || !currentUser) return;

    // Remove existing friends list if any
    const existingList = navbarRight.querySelector('.friends-list');
    if (existingList) {
        existingList.remove();
    }

    // Create new friends list container
    const friendsList = document.createElement('div');
    friendsList.className = 'friends-list';

    try {
        // Get friends data
        const friendsCollectionRef = collection(db, 'users', currentUser.uid, 'friends');
        const snapshot = await getDocs(friendsCollectionRef);
        
        if (snapshot.empty) {
            friendsList.innerHTML = '<div class="list-item">No friends yet</div>';
        } else {
            const friends = [];
            snapshot.forEach(doc => {
                friends.push({ uid: doc.id, ...doc.data() });
            });

            // Get friend names
            const friendData = await fetchUserNames(friends.map(f => f.uid));

            // Create list items
            friends.forEach(friend => {
                const friendItem = document.createElement('div');
                friendItem.className = 'list-item';
                friendItem.innerHTML = `
                    <strong>${friendData[friend.uid]?.name || 'User'}</strong>
                    <small>${friendData[friend.uid]?.email || 'Email Not Available'}</small>
                `;
                
                // Add click handler to start chat
                friendItem.addEventListener('click', () => {
                    initiateChat(friend.uid, friendData[friend.uid]?.name || 'User');
                    navbarRight.classList.remove('mobile-visible');
                    friendsList.classList.remove('show');
                });
                
                friendsList.appendChild(friendItem);
            });
        }

        // Insert friends list after the Friends button
        const friendsButton = navbarRight.querySelector('#friends-nav-button');
        if (friendsButton) {
            navbarRight.insertBefore(friendsList, friendsButton.nextSibling);
        }
    } catch (error) {
        console.error('Error populating mobile friends list:', error);
        friendsList.innerHTML = '<div class="list-item">Error loading friends</div>';
    }
}

// Function to fetch and display user data
async function fetchAndDisplayUserData(uid) {
    const userDocRef = doc(db, 'users', uid);
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
        const userData = docSnap.data();
        if(userNameDisplay) userNameDisplay.textContent = userData.name || 'User';
    } else {
        console.error("No user data found in Firestore for UID:", uid);
        if(userNameDisplay) userNameDisplay.textContent = 'User Data Missing';
    }
}

// Function to setup live search listener with debounce
function setupLiveSearch() {
   if(searchInput && searchButton && searchResultsDiv) {
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
   } else {
       console.error("Search elements not found");
   }
}

// Function to perform the actual user search
async function performSearch(searchTerm) {
   if(!searchResultsDiv) return;

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
                // On mobile, hide sidebar when chat is initiated
                const sidebar = document.querySelector('.sidebar');
                if (sidebar && sidebar.classList.contains('active')) {
                    sidebar.classList.remove('active');
                }
            });
        });

    } catch (error) {
        console.error("Error searching users:", error);
         if(searchResultsDiv) searchResultsDiv.innerHTML += '<p class="empty-state">Error searching for users.</p>';
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

         const currentSearchTerm = searchInput?.value.trim(); // Added ?. for safety
         if(currentSearchTerm?.length > 0) { // Added ?. for safety
             performSearch(currentSearchTerm);
         }

    }, (error) => {
        console.error('Error listening to friends:', error); // Fixed unterminated string
        if (friendsListDiv) {
             friendsListDiv.innerHTML = '<p class="empty-state">Error loading friends.</p>';
        }
    });

    // Listener for Incoming Friend Request Badge (on menu.js)
    const incomingRequestsBadgeQuery = query(collection(db, 'friendRequests'),
        where('to', '==', uid),
        where('status', '==', 'pending')
    );
    onSnapshot(incomingRequestsBadgeQuery, (snapshot) => {
        const pendingCount = snapshot.size;
        if (requestsBadge) {
            requestsBadge.textContent = pendingCount;
            if (pendingCount > 0) {
                requestsBadge.classList.remove('hidden');
            } else {
                requestsBadge.classList.add('hidden');
            }
        }
    }, (error) => {
        console.error('Error listening to incoming requests for badge:', error); // Fixed unterminated string
        if (requestsBadge) {
             requestsBadge.classList.add('hidden');
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

// Function to display the current user's friends list (in sidebar)
async function displayFriends(friends) {
   if(!friendsListDiv) return;

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
            // On mobile, hide sidebar when chat is initiated
            const sidebar = document.querySelector('.sidebar');
            if (sidebar && sidebar.classList.contains('active')) {
                sidebar.classList.remove('active');
            }
        });
        friendsListDiv.appendChild(friendItem);
    });
}


// --- Chat Functionality (Integrated into menu.js) ---

// Function to display messages in the chat area
function displayMessages(messageDocs, friendName) {
   if(!chatMessagesListDiv) return;

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
    const messageText = messageInput?.value.trim(); // Added ?. for safety

    if (messageText === '' || !currentChatId || !currentUser || !messageInput) {
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
        if(chatMessagesListDiv) chatMessagesListDiv.scrollTop = chatMessagesListDiv.scrollHeight;
        return;
    }

    if (unsubscribeMessages) {
        unsubscribeMessages();
        unsubscribeMessages = null;
    }

   if(chatMessagesListDiv && chatFriendNameDisplay && messageInput && sendButton) {
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
            console.error('Error listening to messages:', error); // Fixed unterminated string
            if(chatMessagesListDiv) chatMessagesListDiv.innerHTML = '<p class="empty-state">Error loading messages.</p>';
        });

        messageInput.disabled = false;
        sendButton.disabled = false;
   } else {
       console.error("Chat elements not found for initiation");
   }
}


// --- Event Listeners for Chat Functionality ---

// --- Disable message input initially ---


// --- Authentication State Observer ---


// --- Other General Event Listeners ---


document.addEventListener('DOMContentLoaded', () => {
    // Get DOM Elements
    userNameDisplay = document.getElementById('user-name-display');
    themeSwitchButton = document.getElementById('theme-switch');
    logoutButton = document.getElementById('logout-button');
    searchInput = document.getElementById('search-input');
    searchButton = document.getElementById('search-button');
    searchResultsDiv = document.getElementById('search-results');
    friendsListDiv = document.getElementById('friends-list'); // This is the sidebar friends list

    // Get references to chat-specific DOM elements within menu.html
    chatFriendNameDisplay = document.getElementById('chat-friend-name');
    chatMessagesListDiv = document.getElementById('chat-messages-list');
    messageInput = document.getElementById('message-input');
    sendButton = document.getElementById('send-message-button');

    // Get reference to the requests navigation button (from menu.html navbar)
    requestsNavButton = document.getElementById('requests-nav-button');

    // Get reference to the requests badge element
    requestsBadge = document.getElementById('requests-badge');

    // Get reference to the mobile menu toggle button and the mobile Friends button
    mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    friendsNavButton = document.getElementById('friends-nav-button'); // The Friends button in navbar-left

    // --- Event Listeners ---

    // Add event listener for mobile menu toggle (Hamburger)
    mobileMenuToggle?.addEventListener('click', () => {
        const navbarRight = document.querySelector('.navbar-right');
        if (navbarRight) {
            navbarRight.classList.toggle('mobile-visible');
        }
        // Ensure sidebar is closed when opening the mobile menu dropdown
        const sidebar = document.querySelector('.sidebar');
        if (sidebar?.classList.contains('active')) {
            sidebar.classList.remove('active');
        }
    });

    // Add event listener for Friends button
    friendsNavButton?.addEventListener('click', (event) => {
        // On mobile, toggle the sidebar
        if (window.innerWidth <= 768) {
            event.preventDefault(); // Prevent potential default link behavior if it were a link
            toggleSidebar();
            // Ensure mobile menu dropdown is closed when opening sidebar via Friends button
            const navbarRight = document.querySelector('.navbar-right');
            if (navbarRight?.classList.contains('mobile-visible')) {
                 navbarRight.classList.remove('mobile-visible');
            }
        } else {
            // On desktop, the button is just there, no default JS action needed unless desired
            // You could add desktop specific behavior here if needed, e.g., toggle sidebar
             // toggleSidebar(); // Uncomment if you want Friends button to toggle sidebar on desktop too
        }
    });

    // Close mobile menu and sidebar when clicking outside
    document.addEventListener('click', (e) => {
        const sidebar = document.querySelector('.sidebar');
        const navbarRight = document.querySelector('.navbar-right');
        const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
        const friendsNavButton = document.getElementById('friends-nav-button');

        // Check if the click is outside the sidebar AND outside the mobile menu toggle AND outside the friends nav button
        // and if either the sidebar or the navbarRight (mobile menu) is currently active
        const isClickOutsideSidebar = sidebar && !sidebar.contains(e.target);
        const isClickOutsideMobileToggle = mobileMenuToggle && !mobileMenuToggle.contains(e.target);
        const isClickOutsideFriendsButton = friendsNavButton && !friendsNavButton.contains(e.target);
        const isSidebarActive = sidebar?.classList.contains('active');
        const isMobileMenuVisible = navbarRight?.classList.contains('mobile-visible');

        if (isSidebarActive && isClickOutsideSidebar && isClickOutsideMobileToggle && isClickOutsideFriendsButton) {
             sidebar.classList.remove('active');
        }

        if (isMobileMenuVisible && isClickOutsideSidebar && isClickOutsideMobileToggle && isClickOutsideFriendsButton) {
             navbarRight.classList.remove('mobile-visible');
        }

         // Special case: if sidebar is open and you click the friends button on mobile, it should close the menu
         if (isSidebarActive && friendsNavButton && friendsNavButton.contains(e.target) && window.innerWidth <= 768) {
              navbarRight?.classList.remove('mobile-visible');
         }
          // Special case: if mobile menu is open and you click the mobile toggle, it should close the sidebar
         if (isMobileMenuVisible && mobileMenuToggle && mobileMenuToggle.contains(e.target) && window.innerWidth <= 768) {
             sidebar?.classList.remove('active');
         }

    });

    // Event Listeners for Chat Functionality
    sendButton?.addEventListener('click', () => sendMessage());

    messageInput?.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            sendMessage();
        }
    });

    // Theme switch button listener
    themeSwitchButton?.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        if (document.body.classList.contains('dark-mode')) {
            localStorage.setItem('theme', 'dark');
        } else {
            localStorage.setItem('theme', 'light');
        }
    });

    // Logout button listener
    logoutButton?.addEventListener('click', () => {
        signOut(auth).then(() => {
            console.log("User signed out.");
        }).catch((error) => {
            console.error("Logout Error:", error);
            alert("Error logging out: " + error.message);
        });
    });

    // Event Listener for Requests Navigation Button
    if (requestsNavButton) {
        requestsNavButton.addEventListener('click', () => {
            window.location.href = 'requests.html';
        });
    } else {
        console.error("Requests navigation button not found in menu.html");
    }

    // --- Authentication State Observer ---
    // This listener is placed AFTER the function definitions
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            console.log("User is signed in on menu page:", currentUser.uid);

            fetchAndDisplayUserData(currentUser.uid);
            setupRealtimeListeners(currentUser.uid); // Sets up listeners for friends and badge
            setupLiveSearch();

            // Show default chat state or a message (e.g., "Select a friend to chat")
            if(chatFriendNameDisplay && chatMessagesListDiv) {
                 chatFriendNameDisplay.textContent = "Select a friend to chat";
                 chatMessagesListDiv.innerHTML = '<p class="empty-state">No conversation selected.</p>';
            }

        } else {
            currentUser = null;
            console.log("User is signed out. Redirecting to login.");
            window.location.href = 'index.html';
        }
    });

    // --- Initial State / Setup ---
    // Disable message input initially
    if(messageInput && sendButton) {
        messageInput.disabled = true;
        sendButton.disabled = true;
    }
    
    // Apply saved theme preference on page load
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
    }
}); 