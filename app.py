from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import json
import os
from datetime import datetime
from geolocation import get_location
import threading

app = Flask(__name__)
CORS(app)

# Store emergency calls data
emergency_calls = []
call_recordings = {}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/emergency-call', methods=['POST'])
def emergency_call():
    """
    Handle emergency call requests
    """
    try:
        data = request.json
        caller_info = {
            'timestamp': datetime.now().isoformat(),
            'phone': data.get('phone'),
            'name': data.get('name'),
            'latitude': data.get('latitude'),
            'longitude': data.get('longitude'),
            'emergency_type': data.get('emergency_type'),
            'description': data.get('description'),
            'location_address': data.get('location_address'),
            'is_offline': data.get('is_offline', False),
            'recording_id': data.get('recording_id')
        }
        
        emergency_calls.append(caller_info)
        
        # Save to file for persistence
        with open('emergency_logs.json', 'a') as f:
            f.write(json.dumps(caller_info) + '\n')
        
        return jsonify({
            'success': True,
            'message': 'Emergency call recorded',
            'call_id': len(emergency_calls) - 1
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/api/location', methods=['POST'])
def get_caller_location():
    """
    Get caller's current location
    """
    try:
        data = request.json
        lat = data.get('latitude')
        lng = data.get('longitude')
        
        # Get location details
        location_data = get_location(lat, lng)
        
        return jsonify({
            'success': True,
            'location': location_data
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/api/recording/start', methods=['POST'])
def start_recording():
    """
    Start call recording
    """
    try:
        recording_id = f"rec_{datetime.now().timestamp()}"
        call_recordings[recording_id] = {
            'started_at': datetime.now().isoformat(),
            'data': []
        }
        return jsonify({
            'success': True,
            'recording_id': recording_id
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/api/recording/stop/<recording_id>', methods=['POST'])
def stop_recording(recording_id):
    """
    Stop call recording
    """
    try:
        if recording_id in call_recordings:
            call_recordings[recording_id]['stopped_at'] = datetime.now().isoformat()
            call_recordings[recording_id]['duration'] = len(call_recordings[recording_id]['data'])
            
            # Save recording to file
            with open(f'recordings/{recording_id}.json', 'w') as f:
                json.dump(call_recordings[recording_id], f)
            
            return jsonify({
                'success': True,
                'message': 'Recording saved'
            }), 200
        else:
            return jsonify({'success': False, 'error': 'Recording not found'}), 404
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/api/calls', methods=['GET'])
def get_calls():
    """
    Retrieve all emergency calls (for admin panel)
    """
    return jsonify({
        'success': True,
        'calls': emergency_calls,
        'total': len(emergency_calls)
    }), 200

@app.route('/api/health', methods=['GET'])
def health_check():
    """
    Health check endpoint
    """
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat()
    }), 200

if __name__ == '__main__':
    os.makedirs('recordings', exist_ok=True)
    app.run(debug=True, host='0.0.0.0', port=5000)
