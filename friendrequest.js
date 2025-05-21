// friendrequest.js

// Import necessary Firebase services from your config file
import { db, auth } from "./config.js"; // Assuming config.js is in the same directory

// Import Firestore functions needed for friend requests
import {
    collection, query, where, getDocs, addDoc,
    updateDoc, deleteDoc, onSnapshot, serverTimestamp, doc, getDoc, documentId,
    setDoc // <--- Make sure setDoc is included HERE
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js"; // <--- Check the URL is correct


// --- Handle Friend Request Actions (Accept/Reject/Cancel) ---
// *** Define action handler functions FIRST ***

// Function for handling accept friend request
async function handleAcceptFriendRequest(event, fetchUserNames) { // Accept helper function
    const requestId = event.target.dataset.requestId;
    const senderUid = event.target.dataset.senderUid;
    const receiverUid = auth.currentUser.uid; // Get current user UID from auth instance

    if (!requestId || !senderUid || !receiverUid) {
        console.error("Invalid accept request data.");
        return;
    }

    const requestDocRef = doc(db, 'friendRequests', requestId);
    const receiverFriendsCollectionRef = collection(db, 'users', receiverUid, 'friends');
    const senderFriendsCollectionRef = collection(db, 'users', senderUid, 'friends');

     try {
        console.log("Attempting to accept request:", requestId, "from", senderUid, "by", receiverUid);

        // Fetch sender's name and email to store in receiver's friends list
        const senderData = await fetchUserNames([senderUid]);
        const senderName = senderData[senderUid]?.name || 'User';
        const senderEmail = senderData[senderUid]?.email || 'Email Not Available';
        console.log("Fetched sender data:", senderData[senderUid]);

        // Fetch receiver's name and email to store in sender's friends list
         const receiverData = await fetchUserNames([receiverUid]);
         const receiverName = receiverData[receiverUid]?.name || 'User';
         const receiverEmail = receiverData[receiverUid]?.email || 'Email Not Available';
         console.log("Fetched receiver data:", receiverData[receiverUid]);


        // Add sender to receiver's friends subcollection, including name and email
        console.log("Attempting to write to receiver's friends list:", `/users/${receiverUid}/friends/${senderUid}`);
        await setDoc(doc(receiverFriendsCollectionRef, senderUid), {
            addedAt: serverTimestamp(),
            name: senderName,
            email: senderEmail
        });
        console.log("Successfully wrote to receiver's friends list.");


        // Add receiver to sender's friends subcollection, including name and email
        console.log("Attempting to write to sender's friends list:", `/users/${senderUid}/friends/${receiverUid}`);
         await setDoc(doc(senderFriendsCollectionRef, receiverUid), {
             addedAt: serverTimestamp(),
             name: receiverName,
             email: receiverEmail
         });
         console.log("Successfully wrote to sender's friends list.");


        // Delete the request document
        console.log("Attempting to delete friend request:", `/friendRequests/${requestId}`);
         await deleteDoc(requestDocRef);
         console.log("Successfully deleted friend request.");


        console.log(`Friend request ${requestId} acceptance process completed.`);
        // UI updates will be handled by the realtime listeners (onSnapshot)

    } catch (error) {
        console.error("Error accepting friend request:", error.code, error.message, error);
        alert("Failed to accept friend request.");
    }
}

// Function for handling reject friend request
async function handleRejectFriendRequest(event) {
    const requestId = event.target.dataset.requestId;

     if (!requestId) {
        console.error("Invalid reject request data.");
        return;
    }

    const requestDocRef = doc(db, 'friendRequests', requestId);

     try {
        // Delete the request document
         await deleteDoc(requestDocRef);

        console.log(`Friend request ${requestId} rejected.`);
         // UI updates will be handled by the realtime listeners

     } catch (error) {
        console.error("Error rejecting friend request:", error);
        alert("Failed to reject friend request.");
     }
}

// Function for handling cancel friend request
async function handleCancelFriendRequest(event) {
     const requestId = event.target.dataset.requestId;

     if (!requestId) {
        console.error("Invalid cancel request data.");
        return;
    }

    const requestDocRef = doc(db, 'friendRequests', requestId);

     try {
         await deleteDoc(requestDocRef);
        console.log(`Outgoing request ${requestId} cancelled.`);
     } catch (error) {
        console.error("Error cancelling friend request:", error);
        alert("Failed to cancel friend request.");
     }
}


// --- Handle Sending Friend Request ---
export async function handleSendFriendRequest(event, currentUserUid, fetchUserNames) {
    const recipientId = event.target.dataset.uid;
    const senderId = currentUserUid;

    if (!recipientId || !senderId || senderId === recipientId) {
        console.error("Invalid request data.");
        return;
    }

    // Prevent sending multiple requests to the same person (basic check)
    const existingRequestQuery = query(collection(db, 'friendRequests'),
        where('from', '==', senderId),
        where('to', '==', recipientId),
        where('status', '==', 'pending')
    );
     const existingRequestSnapshot = await getDocs(existingRequestQuery);

     if (!existingRequestSnapshot.empty) {
         console.log("Pending request already sent to this user.");
         event.target.textContent = 'Request Sent';
         event.target.disabled = true;
         return;
     }

      // Basic check if already friends (this check depends on your friend list structure)
     const friendDocRef = doc(db, 'users', senderId, 'friends', recipientId);
     const friendDocSnap = await getDoc(friendDocRef);
      if (friendDocSnap.exists()) {
           console.log("Already friends with this user.");
           event.target.textContent = 'Already Friends';
           event.target.disabled = true;
           return;
      }


    // Add a new document to the 'friendRequests' collection
    try {
        await addDoc(collection(db, 'friendRequests'), {
            from: senderId,
            to: recipientId,
            status: 'pending',
            createdAt: serverTimestamp()
        });
        console.log("Friend request sent to", recipientId);
        event.target.textContent = 'Request Sent';
        event.target.disabled = true; // Disable the button after sending

    } catch (error) {
        console.error("Error sending friend request:", error);
        alert("Failed to send friend request.");
    }
}


// --- Setup Friend Request Listeners ---
// This function will be called from menu.js to set up the listeners
export function setupFriendRequestListeners(uid, incomingRequestsListDiv, outgoingRequestsListDiv, fetchUserNames) {

    // Listener for Incoming Friend Requests
    const incomingRequestsQuery = query(collection(db, 'friendRequests'),
        where('to', '==', uid),
        where('status', '==', 'pending')
    );
     onSnapshot(incomingRequestsQuery, async (snapshot) => {
         const incomingRequests = [];
         const senderUids = [];
         snapshot.forEach(doc => {
              const request = { id: doc.id, ...doc.data() };
              incomingRequests.push(request);
              senderUids.push(request.from);
         });
         console.log("Incoming requests:", incomingRequests);

         const sendersData = await fetchUserNames(senderUids);
         displayIncomingRequests(incomingRequests, sendersData, incomingRequestsListDiv, fetchUserNames); // Pass fetchUserNames

     }, (error) => {
         console.error("Error listening to incoming requests:", error);
     });

    // Listener for Outgoing Friend Requests
    const outgoingRequestsQuery = query(collection(db, 'friendRequests'),
        where('from', '==', uid),
        where('status', '==', 'pending')
    );
     onSnapshot(outgoingRequestsQuery, async (snapshot) => {
         const outgoingRequests = [];
         const recipientUids = [];
         snapshot.forEach(doc => {
              const request = { id: doc.id, ...doc.data() };
              outgoingRequests.push(request);
              recipientUids.push(request.to);
         });
         console.log("Outgoing requests:", outgoingRequests);

         const recipientsData = await fetchUserNames(recipientUids);
         displayOutgoingRequests(outgoingRequests, recipientsData, outgoingRequestsListDiv); // Pass outgoingRequestsListDiv

     }, (error) => {
         console.error("Error listening to outgoing requests:", error);
     });

}


// --- Display Functions for Friend Requests ---
// *** Define display functions AFTER handler functions, but before calling them ***

// Display function for incoming requests (modified to accept DOM element and fetchUserNames)
function displayIncomingRequests(requests, sendersData, incomingRequestsListDiv, fetchUserNames) {
    incomingRequestsListDiv.innerHTML = '';

    if (requests.length === 0) {
        incomingRequestsListDiv.innerHTML = '<p class="empty-state">No incoming requests.</p>';
        return;
    }

    requests.forEach(request => {
        const requestItem = document.createElement('div');
         requestItem.classList.add('list-item', 'no-hover');
        requestItem.innerHTML = `
            <span>
                 <strong>${sendersData[request.from]?.name || 'User'}</strong><br>
                 <small>${sendersData[request.from]?.email || 'Email Not Available'}</small> wants to be friends.
            </span>
            <div>
                <button class="accept-button" data-request-id="${request.id}" data-sender-uid="${request.from}">Accept</button>
                <button class="reject-button" data-request-id="${request.id}">Reject</button>
            </div>
        `;
        incomingRequestsListDiv.appendChild(requestItem);
    });

     // Add event listeners to accept/reject buttons
     incomingRequestsListDiv.querySelectorAll('.accept-button').forEach(button => {
        button.addEventListener('click', (event) => { // Use anonymous function to pass fetchUserNames
            handleAcceptFriendRequest(event, fetchUserNames); // Call handler, pass fetchUserNames
        });
    });
     incomingRequestsListDiv.querySelectorAll('.reject-button').forEach(button => {
        button.addEventListener('click', handleRejectFriendRequest); // Call handler
    });
}

// Display function for outgoing requests
function displayOutgoingRequests(requests, recipientsData, outgoingRequestsListDiv) {
     outgoingRequestsListDiv.innerHTML = '';

    if (requests.length === 0) {
        outgoingRequestsListDiv.innerHTML = '<p class="empty-state">No outgoing requests.</p>';
        return;
    }

    requests.forEach(request => {
        const requestItem = document.createElement('div');
         requestItem.classList.add('list-item', 'no-hover');
        requestItem.innerHTML = `
            <span>
                Request sent to <strong>${recipientsData[request.to]?.name || 'User'}</strong><br>
                <small>${recipientsData[request.to]?.email || 'Email Not Available'}</small>.
            </span>
            <button class="cancel-button" data-request-id="${request.id}">Cancel</button>
        `;
        outgoingRequestsListDiv.appendChild(requestItem);
    });

     // Add event listeners to cancel buttons
    outgoingRequestsListDiv.querySelectorAll('.cancel-button').forEach(button => {
        button.addEventListener('click', handleCancelFriendRequest); // Call handler
    });
}