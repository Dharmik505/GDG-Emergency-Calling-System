// GDG Emergency Calling System - Frontend JavaScript

let currentLocation = null;
let isRecording = false;
let recordingId = null;
let isOnline = navigator.onLine;
const API_BASE_URL = '/api';
const OFFLINE_STORAGE_KEY = 'emergency_calls_offline';

// Check online/offline status
window.addEventListener('online', handleOnline);
window.addEventListener('offline', handleOffline);

function handleOnline() {
    isOnline = true;
    document.getElementById('offlineMode').style.display = 'none';
    syncOfflineData();
    showStatus('Back online! Syncing data...', 'info');
}

function handleOffline() {
    isOnline = false;
    document.getElementById('offlineMode').style.display = 'block';
    showStatus('You are offline. Your data will sync when online.', 'info');
}

// Initialize offline check
if (!isOnline) {
    document.getElementById('offlineMode').style.display = 'block';
}

/**
 * Get user's current location
 */
function getLocation() {
    showStatus('Getting your location...', 'info');
    
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                const { latitude, longitude } = position.coords;
                currentLocation = { latitude, longitude };
                
                // Update location info display
                document.getElementById('latitude').textContent = latitude.toFixed(6);
                document.getElementById('longitude').textContent = longitude.toFixed(6);
                document.getElementById('accuracy').textContent = position.coords.accuracy.toFixed(2) + ' meters';
                document.getElementById('locationInfo').style.display = 'block';
                
                // Get address from coordinates (reverse geocoding)
                getAddressFromCoordinates(latitude, longitude);
                showStatus('Location obtained successfully!', 'success');
            },
            function(error) {
                showStatus('Error getting location: ' + error.message, 'error');
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    } else {
        showStatus('Geolocation not supported in this browser', 'error');
    }
}

/**
 * Get address from latitude and longitude
 */
function getAddressFromCoordinates(lat, lng) {
    if (!isOnline) {
        document.getElementById('address').textContent = 'Offline mode - address will load when online';
        return;
    }
    
    fetch(`/api/location`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            latitude: lat,
            longitude: lng
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const addr = data.location.display_name || 'Location found';
            document.getElementById('address').textContent = addr;
        }
    })
    .catch(error => {
        console.log('Address lookup error:', error);
        document.getElementById('address').textContent = `${lat}, ${lng}`;
    });
}

/**
 * Start call recording
 */
function startRecording() {
    if (isRecording) {
        showStatus('Recording already in progress', 'error');
        return;
    }
    
    if (!isOnline) {
        recordingId = 'offline_' + Date.now();
        isRecording = true;
        document.getElementById('recordingStatus').style.display = 'block';
        showStatus('Recording started (Offline mode)', 'info');
        return;
    }
    
    fetch(`${API_BASE_URL}/recording/start`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            recordingId = data.recording_id;
            isRecording = true;
            document.getElementById('recordingStatus').style.display = 'block';
            showStatus('Call recording started', 'success');
        }
    })
    .catch(error => {
        showStatus('Error starting recording: ' + error.message, 'error');
    });
}

/**
 * Stop call recording
 */
function stopRecording() {
    if (!isRecording) {
        showStatus('No recording in progress', 'error');
        return;
    }
    
    isRecording = false;
    document.getElementById('recordingStatus').style.display = 'none';
    
    if (!isOnline || recordingId.startsWith('offline_')) {
        showStatus('Recording stopped and saved locally', 'success');
        return;
    }
    
    fetch(`${API_BASE_URL}/recording/stop/${recordingId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showStatus('Call recording saved securely', 'success');
        }
    })
    .catch(error => {
        showStatus('Error stopping recording: ' + error.message, 'error');
    });
}

/**
 * Trigger emergency call immediately
 */
function triggerEmergency() {
    const confirmed = confirm('TRIGGER EMERGENCY CALL?\n\nThis will immediately alert emergency services. Confirm?');
    if (confirmed) {
        // Get location first if not already obtained
        if (!currentLocation) {
            showStatus('Getting your location for emergency call...', 'info');
            navigator.geolocation.getCurrentPosition(
                function(position) {
                    currentLocation = { 
                        latitude: position.coords.latitude, 
                        longitude: position.coords.longitude 
                    };
                    submitEmergencyCall();
                },
                function() {
                    submitEmergencyCall(); // Submit without location if unavailable
                }
            );
        } else {
            submitEmergencyCall();
        }
    }
}

/**
 * Submit emergency call form
 */
function submitEmergencyCall(event) {
    if (event) {
        event.preventDefault();
    }
    
    const formData = {
        name: document.getElementById('name').value,
        phone: document.getElementById('phone').value,
        emergency_type: document.getElementById('emergencyType').value,
        description: document.getElementById('description').value,
        latitude: currentLocation?.latitude || null,
        longitude: currentLocation?.longitude || null,
        location_address: document.getElementById('address').textContent,
        is_offline: !isOnline,
        recording_id: recordingId
    };
    
    // Validate required fields
    if (!formData.name || !formData.phone) {
        showStatus('Please fill in Name and Phone Number', 'error');
        return;
    }
    
    // Save to offline storage
    saveToOfflineStorage(formData);
    
    if (!isOnline) {
        showStatus('Emergency call saved offline. Will send when online.', 'info');
        resetForm();
        return;
    }
    
    // Send to server
    fetch(`${API_BASE_URL}/emergency-call`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showStatus('✓ Emergency call submitted successfully! ID: ' + data.call_id, 'success');
            resetForm();
        } else {
            showStatus('Error: ' + (data.error || 'Unknown error'), 'error');
        }
    })
    .catch(error => {
        showStatus('Error submitting emergency call: ' + error.message, 'error');
        // Save offline anyway
        showStatus('Saved offline. Will retry when online.', 'info');
    });
}

/**
 * Save emergency call to offline storage
 */
function saveToOfflineStorage(data) {
    try {
        let offlineCalls = JSON.parse(localStorage.getItem(OFFLINE_STORAGE_KEY) || '[]');
        offlineCalls.push({
            ...data,
            timestamp: new Date().toISOString()
        });
        localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(offlineCalls));
    } catch (error) {
        console.error('Error saving to offline storage:', error);
    }
}

/**
 * Sync offline data when coming back online
 */
function syncOfflineData() {
    try {
        const offlineCalls = JSON.parse(localStorage.getItem(OFFLINE_STORAGE_KEY) || '[]');
        
        if (offlineCalls.length === 0) return;
        
        offlineCalls.forEach(call => {
            fetch(`${API_BASE_URL}/emergency-call`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(call)
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Remove from offline storage
                    const remaining = JSON.parse(localStorage.getItem(OFFLINE_STORAGE_KEY) || '[]')
                        .filter(c => c.timestamp !== call.timestamp);
                    localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(remaining));
                }
            })
            .catch(error => console.error('Error syncing:', error));
        });
    } catch (error) {
        console.error('Error syncing offline data:', error);
    }
}

/**
 * Reset the emergency form
 */
function resetForm() {
    document.getElementById('emergencyForm').reset();
    document.getElementById('locationInfo').style.display = 'none';
    document.getElementById('recordingStatus').style.display = 'none';
    currentLocation = null;
    isRecording = false;
    recordingId = null;
}

/**
 * Show status message
 */
function showStatus(message, type) {
    const statusEl = document.getElementById('statusMessage');
    statusEl.textContent = message;
    statusEl.className = 'status-message ' + type;
    statusEl.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        statusEl.style.display = 'none';
    }, 5000);
}

// Form submit handler
document.getElementById('emergencyForm')?.addEventListener('submit', submitEmergencyCall);

// Health check
function checkServerHealth() {
    fetch(`${API_BASE_URL}/health`)
        .then(response => response.json())
        .then(data => console.log('Server health:', data))
        .catch(error => console.log('Server unavailable:', error));
}

// Check server on page load
window.addEventListener('load', checkServerHealth);
