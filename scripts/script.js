function writeSessions() {
    // Define a variable for the collection you want to create in Firestore
    var sessionsRef = db.collection("sessions");

    // Get the selected length from the button text
    var selectedLength = document.getElementById("lengthInput").textContent;

    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            // Get user's email
            var userEmail = user.email;

            // Fetch user's name from Firestore before proceeding
            db.collection("users").doc(user.uid).get().then(doc => {
                if (doc.exists) {
                    var userName = doc.data().name; // Get the stored name

                    // Start geolocation after retrieving the name
                    navigator.geolocation.getCurrentPosition(function (position) {
                        var geolocation = new firebase.firestore.GeoPoint(position.coords.latitude, position.coords.longitude);
                        
                        // Create the session only after userName is available
                        sessionsRef.add({
                            owner: userName,  // Store the authenticated user's name instead of UID
                            ownerEmail: userEmail, // Store the authenticated user's email
                            geolocation: geolocation,
                            description: document.querySelector('#sessionFormInput').value,
                            length: selectedLength, // Store selected length
                            timestamp: firebase.firestore.FieldValue.serverTimestamp() // Current system time
                        })
                            .then(docRef => {  // Once the session is successfully created...
                                //  Update the logged-in user's document in Firestore to store the session ID
                                db.collection("users").doc(user.uid).update({
                                    session: docRef.id // Store the newly created session's unique ID in the user's document
                                })
                                    .catch(error => { // Handle errors if the user document update fails
                                        console.error("Error updating user document: ", error);
                                    });
                            })
                            .catch(error => { // Handle errors if session creation fails
                                console.error("Error adding session: ", error);
                            });
                            
                    }, function (error) {
                        console.error("Geolocation error: " + error.message);
                        alert("Could not retrieve geolocation. Please try again.");
                    });

                } else {
                    console.error("User document does not exist in Firestore.");
                }
            }).catch(error => {
                console.error("Error fetching user name from Firestore:", error);
            });

        } else {
            alert("You must be logged in to create a session.");
        }
    });
}


function checkSessionExpiration(sessionId, created, length) {
    // Convert session length to milliseconds
    let lengthInMillis = convertLengthToMillis(length);

    // Calculate the expiration time (created time + session length)
    let expirationTime = created.seconds * 1000 + lengthInMillis; // created is a Firestore timestamp

    // Get the current time
    let currentTime = Date.now();

    // If the current time has passed the expiration time, delete the session
    if (currentTime >= expirationTime) {

        //Find the user that owns this session
        db.collection("users").where("session", "==", sessionId).get()
            .then(querySnapshot => {
                // 🔽 ADDED: Directly access the first (and only) matching user document
                let userDoc = querySnapshot.docs[0];

                // Clear the session field in that user's Firestore document
                db.collection("users").doc(userDoc.id).update({ session: null })
                    .then(() => {
                        console.log("User session cleared.");

                        // Delete session *after* clearing the user's session field
                        deleteSession(sessionId);
                    })
                    .catch(error => {
                        console.error("Error clearing user session:", error);
                    });
            })
            .catch(error => {
                console.error("Error finding user with session:", error);
            });


    }
}

function convertLengthToMillis(length) {
    // Convert session length string to milliseconds
    if (length === "30 minutes") {
        return 30 * 60 * 1000;
    } else if (length === "1 hour") {
        return 60 * 60 * 1000;
    } else if (length === "2 hours") {
        return 2 * 60 * 60 * 1000;
    }
    return 0; // Default to 0 if no length is matched
}

// Example: Check every minute
setInterval(function () {
    db.collection("sessions").get().then(snapshot => {
        snapshot.forEach(doc => {
            const data = doc.data();
            const created = data.created; // Firestore timestamp
            const length = data.length;

            // Check if session is expired
            checkSessionExpiration(doc.id, created, length);
        });
    });
}, 60000); // Check every minute (60000 ms)


function deleteSession(sessionId) {
    var sessionRef = db.collection("sessions").doc(sessionId);

    sessionRef.delete().then(function () {
        console.log("Session successfully deleted!");
    }).catch(function (error) {
        console.error("Error removing session: ", error);
    });
}

// Wait until the entire HTML document is fully loaded before running this code
document.addEventListener("DOMContentLoaded", () => {

    // Look for the delete session button in the DOM by its unique ID
    const deleteBtn = document.getElementById("delete-session-btn");

    //  Check that the button actually exists on the page before trying to use it
    // This prevents errors in case the button isn't rendered yet or is missing from the HTML
    if (deleteBtn) {

        //  Attach an event listener to the button that listens for a "click" event
        // When the button is clicked, it will call the deleteCurrentUserSession() function
        deleteBtn.addEventListener("click", deleteCurrentUserSession);
    }
});
