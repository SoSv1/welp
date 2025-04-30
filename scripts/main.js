function showMap() {

    //---------------------------------------------------------------------------------
    // STEP ONE:  Find out where the user is first
    // If the user allows location access, use their location to initialize the map;
    // Otherwise, use the default location.
    //---------------------------------------------------------------------------------
    //Default location (YVR city hall) 49.26504440741209, -123.11540318587558
    let defaultCoords = { lat: 49.2490, lng: -123.0019 };

    

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                // Locaion object as a key-value pair
                let userCoords = {
                    lng: position.coords.longitude,
                    lat: position.coords.latitude
                };
                console.log(userCoords);
                initializeMap(userCoords);
            }, (error) => {
                console.warn("Geolocation error:", error);
                initializeMap(defaultCoords); // Load with default location
            }
        )
    } else {
        console.error("Geolocation is not supported.");
        initializeMap(defaultCoords); // Load with default location
    }


    //---------------------------------------------------------------------------------
    // STEP TWO:  Initialize the map
    // This function will create the map object and add the user's location to the map
    // as a pin. It will also add an event listener for when the user clicks on the map
    // to get the route from the user's location to the clicked location.
    //
    // @params   coords:  an object with the user's location as a key-value pair
    //---------------------------------------------------------------------------------
    function initializeMap(coords) {

        //---------------------------------------------------------------
        // Convert the key value pair structure to an array of coordinates
        //---------------------------------------------------------------
        var userLocation = [coords.lng, coords.lat];   //user's location 
        console.log(userLocation);
        //----------------------
        // Create the map "map"
        //----------------------
        mapboxgl.accessToken = 'pk.eyJ1IjoiLWNsYW5rYXBsdW0tIiwiYSI6ImNtODR0Zm54YzJhenAyanEza2Z3eG50MmwifQ.Kx9Kioj3BBgqC5-pSkZkNg';
        const map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/streets-v11', // Styling URL,
            center: userLocation, // center the map at the user's location
            //center: [-123.0019, 49.2490], // Starting position
            zoom: 15
        });

        //---------------------------------------------------------------------------------
        // Add the user's location to the map
        //---------------------------------------------------------------------------------
        showPoint(map, userLocation);

        //---------------------------------------------------------------------------------
        // Add the clicked location to the map
        // After the click, get the route from the user's location to the clicked location
        //---------------------------------------------------------------------------------
        getClickedLocation(map, (clickedLocation) => {
             getRoute(map, userLocation, clickedLocation);
        });

        //---------------------------------
        // Add interactive pins for the sessions
        //---------------------------------
        addSessionPinsCircle(map);
    }
}
showMap();

// update the Length button's text when a dropdown item is selected.
function updateLength(length) {
    document.getElementById("lengthInput").textContent = length;
    document.getElementById("sessionLengthValue").value = length;
    checkFormReady(); // call validation check
}

function addSessionPinsCircle(map) {
    db.collection('sessions').get().then(allEvents => {

        const features = [];

        allEvents.forEach(doc => {
            // Extract coordinates of the session

            var coordinates = [doc.data().geolocation.longitude, doc.data().geolocation.latitude];

            var sessionDesc = doc.data().description;

            var sessionLength = doc.data().length;

            var sessionOwner = doc.data().owner;

            var sessionEmail = doc.data().ownerEmail;

            features.push({
                'type': 'Feature',
                'properties': {
                    'description': sessionDesc,
                    'length': sessionLength,
                    "owner": sessionOwner,
                    "email": sessionEmail
                },
                'geometry': {
                    'type': 'Point',
                    'coordinates': coordinates
                }
            });

        })

        // Adds features (in our case, pins) to the map
        // "places" is the name of this array of features
        map.addSource('places', {
            'type': 'geojson',
            'data': {
                'type': 'FeatureCollection',
                'features': features
            }
        });

        // Creates a layer above the map displaying the pins
        // Add a layer showing the places.
        map.addLayer({
            'id': 'places',
            'type': 'circle',
            'source': 'places',
            'paint': {   // customize colour and size
                'circle-color': 'orange',
                'circle-radius': 10,
                'circle-stroke-width': 4,
                'circle-stroke-color': '#ffffff'
            }
        });

        // When one of the "places" markers are clicked,
        // create a popup that shows information 
        // Everything related to a marker is save in features[] array
        map.on('click', 'places', (e) => {
            // Copy coordinates array.
            const coordinates = e.features[0].geometry.coordinates.slice();
            const description = e.features[0].properties.description;
            const length = e.features[0].properties.length;
            const owner = e.features[0].properties.owner;
            const email = e.features[0].properties.email;


            // Ensure that if the map is zoomed out such that multiple 
            // copies of the feature are visible, the popup appears over 
            // the copy being pointed to.
            while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
                coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
            }

            new mapboxgl.Popup()
                .setLngLat(coordinates)
                .setHTML(description + " " + length + " created by " + owner + " (" + email + ")")
                .addTo(map);

        });

        // Change the cursor to a pointer when the mouse hovers over the places layer.
        map.on('mouseenter', 'places', () => {
            map.getCanvas().style.cursor = 'pointer';
        });

        // Defaults cursor when not hovering over the places layer
        map.on('mouseleave', 'places', () => {
            map.getCanvas().style.cursor = '';
        });

    })
}

// ---------------------------------------------------------------------
// Add a pin for point that is provided as a parameter point (lat, long)
// when the map loads. Note map.on is an event listener. 
//
// @params   map:  the map object;
//           point:  an array of [lng, lat] coordinates
// ---------------------------------------------------------------------
function showPoint(map, point) {
    map.on('load', () => {
        //a point is added via a layer
        map.addLayer({
            id: 'point',
            type: 'circle',
            source: {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: [
                        {
                            type: 'Feature',
                            properties: {},
                            geometry: {
                                type: 'Point',
                                coordinates: point
                            }
                        }
                    ]
                }
            },
            paint: {
                'circle-radius': 10,
                'circle-color': '#3887be',
                'circle-stroke-width': 6,
                'circle-stroke-color': '#7ED9CA',
                'circle-stroke-opacity': 0.70
            }
        });
    });
}

//-----------------------------------------------------------------------------
// This function is asynchronous event listener for when the user clicks on the map.
// This function will return in the callback, the coordinates of the clicked location
// and display a pin at that location as a map layer
//
// @params   map:  the map object;
//           callback:  a function that will be called with the clicked location
//-----------------------------------------------------------------------------
function getClickedLocation(map, callback) {
    map.on('click', (event) => {
        const clickedLocation = Object.keys(event.lngLat).map((key) => event.lngLat[key]);
        const end = {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    properties: {},
                    geometry: {
                        type: 'Point',
                        coordinates: clickedLocation
                    }
                }
            ]
        };
        if (map.getLayer('end')) {
            map.getSource('end').setData(end);
        } else {
            map.addLayer({
                id: 'end',
                type: 'circle',
                source: {
                    type: 'geojson',
                    data: {
                        type: 'FeatureCollection',
                        features: [
                            {
                                type: 'Feature',
                                properties: {},
                                geometry: {
                                    type: 'Point',
                                    coordinates: clickedLocation
                                }
                            }
                        ]
                    }
                },
                paint: {
                    'circle-radius': 8,
                    'circle-color': '#00ff00',
                    'circle-opacity': 0.50
                }
            });
        }
        console.log(clickedLocation);
        callback(clickedLocation);
    });
}

// --------------------------------------------------------------
// This is an asynchronous function that will use the API to get
// the route from start to end. It will display the route on the map
// and provide turn-by-turn directions in the sidebar.
//
// @params   map:  the start and end coordinates;
//           start and end:  arrays of [lng, lat] coordinates
// -------------------------------------------------------------
async function getRoute(map, start, end) {
    // make a directions request using cycling profile
    // an arbitrary start will always be the same
    // only the end or destination will change
    const query = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/walking/${start[0]},${start[1]};${end[0]},${end[1]}?steps=true&geometries=geojson&access_token=${mapboxgl.accessToken}`,
        { method: 'GET' }
    );
    const json = await query.json();
    const data = json.routes[0];
    const route = data.geometry.coordinates;
    console.log("route is " + route);
    const geojson = {
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'LineString',
            coordinates: route
        }
    };
    // if the route already exists on the map, we'll reset it using setData
    if (map.getSource('route')) {
        map.getSource('route').setData(geojson);
    }
    // otherwise, we'll make a new request
    else {
        map.addLayer({
            id: 'route',
            type: 'line',
            source: {
                type: 'geojson',
                data: geojson
            },
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: {
                'line-color': '#00FF00',
                'line-width': 5,
                'line-opacity': 0.75
            }
        });
    }
}

// Listen for changes in the authentication state (e.g., user logs in or out)
firebase.auth().onAuthStateChanged(user => {
    // Only proceed if a user is currently logged in
    if (user) {
        // Get references to HTML elements used in the session status indicator
        const indicator = document.getElementById("session-indicator");
        const label = document.getElementById("session-indicator-label");
        const deleteBtn = document.getElementById("delete-session-btn");
        const statusMessageElem = document.getElementById("session-status-message");

        // Set up a real-time listener on the current user's document in Firestore
        db.collection("users").doc(user.uid).onSnapshot(userDoc => {
            // Ensure the user's document exists
            if (userDoc.exists) {
                const userName = userDoc.data().name || "there";

                // Get the current session ID for this user
                const sessionId = userDoc.data().session;

                // Check if the user currently has an active session
                if (sessionId && sessionId !== "null") {
                    // Green dot for active session
                    indicator.style.backgroundColor = "green";
                    label.textContent = "Active Session";
                    deleteBtn.style.display = "inline-block";

                    // Fetch session details from Firestore using the active session ID
                    db.collection("sessions").doc(sessionId).get().then(sessionDoc => {
                        // Ensure the session document exists in Firestore
                        if (sessionDoc.exists) {
                            const sessionData = sessionDoc.data();

                            // Retrieve the session's start time and length from the session document
                            const startTime = sessionData.timestamp?.toDate?.(); // Firestore Timestamp to JS Date
                            const length = sessionData.length;


                            console.log("Session Data:", sessionData);
                            console.log("Start Time:", sessionData.timestamp);
                            console.log("Length:", sessionData.length);

                            // Check that both start time and session length are available
                            if (startTime && length) {
                                // Calculate the exact session end time based on its length
                                let endTime = new Date(startTime);
                                if (length === "30 minutes") {
                                    endTime.setMinutes(endTime.getMinutes() + 30);
                                } else if (length === "1 hour") {
                                    endTime.setHours(endTime.getHours() + 1);
                                } else if (length === "2 hours") {
                                    endTime.setHours(endTime.getHours() + 2);
                                }

                                // Format the calculated end time as a readable string (e.g., "02:30 PM")
                                const endTimeString = endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                                // Update the UI with a friendly status message including user's name, session length, and exact end time
                                statusMessageElem.textContent = `Hey ${userName}, your ${length} session ends at ${endTimeString}.`;

                            } else {
                                // Graceful fallback message in case session data is incomplete or missing
                                statusMessageElem.textContent = `Hey ${userName}, session details aren't available.`;
                            }
                        }
                    });

                } else {
                    // Red dot for no active session
                    indicator.style.backgroundColor = "red";
                    label.textContent = "No Active Session";
                    deleteBtn.style.display = "none";

                    // Friendly message for no active sessions
                    statusMessageElem.textContent = `Hey ${userName}, you have no active sessions.`;
                }
            }
        });  // <-- Closes onSnapshot listener
    } // <-- Closes if(user)
}); // <-- Closes firebase.auth listener




function deleteCurrentUserSession() {
    // Get the currently authenticated user from Firebase Auth
    const user = firebase.auth().currentUser;

    // Access the user's document in Firestore and retrieve the session ID
    db.collection("users").doc(user.uid).get().then(doc => {
        // Extract the session ID from the user's Firestore document
        const sessionId = doc.data().session;

        // Since the delete button is only shown when a session is active,
        // we can safely proceed to delete the session document

        // Step 1: Delete the session document from the "sessions" collection
        db.collection("sessions").doc(sessionId).delete()
            .then(() => {
                // Step 2: After successfully deleting the session,
                // update the user's document to set the "session" field to null
                return db.collection("users").doc(user.uid).update({
                    session: null
                });
            })
            .then(() => {
                // Step 3: Log success message to the console
                console.log("Session deleted and user session field cleared.");
            })
            .catch(error => {
                // Handle any errors that occur during deletion or update
                console.error("Error deleting session:", error);
            });
    });
}

/**
 * Toggles the visibility of the session creation form.
 */
function toggleForm() {
    const form = document.getElementById("sessionFormPopup");
    const button = document.querySelector(".btn-sage"); // Create Session button

    const isFormVisible = form.style.display === "block";

    // Toggle visibility
    form.style.display = isFormVisible ? "none" : "block";
    button.style.display = isFormVisible ? "inline-block" : "none"; // Hide or show button
}


// Enable the submit button only if both fields are filled
function checkFormReady() {
    const desc = document.getElementById("sessionFormInput").value.trim();
    const length = document.getElementById("sessionLengthValue").value.trim();
    const submitBtn = document.getElementById("submitSessionBtn");
    submitBtn.disabled = !(desc && length);
}
//  Add listener to check description input on every keystroke
document.addEventListener("DOMContentLoaded", () => {
    const descInput = document.getElementById("sessionFormInput");
    descInput.addEventListener("input", checkFormReady);
});

