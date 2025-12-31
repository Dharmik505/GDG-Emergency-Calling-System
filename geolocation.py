"""Geolocation module for emergency calling system"""

import requests
from typing import Dict, Tuple
import json
import os

# Using OpenStreetMap Nominatim API (free, no API key required)
NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"
CACHE_FILE = "location_cache.json"

def get_location(latitude: float, longitude: float) -> Dict:
    """
    Get location details from coordinates
    Uses OpenStreetMap Nominatim API for reverse geocoding
    
    Args:
        latitude: Latitude coordinate
        longitude: Longitude coordinate
    
    Returns:
        Dictionary with location details
    """
    try:
        # Check cache first
        cached = _check_cache(latitude, longitude)
        if cached:
            return cached
        
        params = {
            'format': 'json',
            'lat': latitude,
            'lon': longitude,
            'zoom': 18,
            'addressdetails': 1
        }
        
        # Make request with timeout
        response = requests.get(
            NOMINATIM_URL,
            params=params,
            timeout=5,
            headers={'User-Agent': 'GDGEmergencySystem/1.0'}
        )
        response.raise_for_status()
        
        data = response.json()
        
        location_data = {
            'latitude': latitude,
            'longitude': longitude,
            'address': data.get('address', {}),
            'display_name': data.get('display_name', 'Unknown Location'),
            'osm_id': data.get('osm_id'),
            'osm_type': data.get('osm_type'),
            'accuracy': _calculate_accuracy(latitude, longitude),
            'timestamp': _get_timestamp()
        }
        
        # Cache the result
        _cache_location(location_data)
        
        return location_data
        
    except requests.RequestException as e:
        return {
            'latitude': latitude,
            'longitude': longitude,
            'error': str(e),
            'display_name': f'Location ({latitude}, {longitude})',
            'accuracy': 'High'
        }
    except Exception as e:
        return {
            'latitude': latitude,
            'longitude': longitude,
            'error': f'Geolocation error: {str(e)}',
            'display_name': 'Offline Mode',
            'offline': True
        }

def get_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate distance between two coordinates using Haversine formula
    Returns distance in kilometers
    """
    from math import radians, cos, sin, asin, sqrt
    
    lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    r = 6371  # Radius of earth in kilometers
    return c * r

def _check_cache(latitude: float, longitude: float) -> Dict | None:
    """
    Check if location is in cache (within 100m)
    """
    if not os.path.exists(CACHE_FILE):
        return None
    
    try:
        with open(CACHE_FILE, 'r') as f:
            cache = json.load(f)
        
        for cached_loc in cache:
            distance = get_distance(
                latitude, longitude,
                cached_loc['latitude'], cached_loc['longitude']
            )
            if distance < 0.1:  # 100 meters
                return cached_loc
    except:
        pass
    
    return None

def _cache_location(location_data: Dict):
    """
    Cache location data for offline support
    """
    try:
        cache = []
        if os.path.exists(CACHE_FILE):
            with open(CACHE_FILE, 'r') as f:
                cache = json.load(f)
        
        cache.append(location_data)
        # Keep only last 100 locations
        cache = cache[-100:]
        
        with open(CACHE_FILE, 'w') as f:
            json.dump(cache, f)
    except:
        pass

def _calculate_accuracy(latitude: float, longitude: float) -> str:
    """
    Calculate location accuracy level
    """
    # Simple accuracy calculation
    # In real world, would use GPS signal strength, number of satellites, etc.
    return "High (GPS)"

def _get_timestamp() -> str:
    """
    Get current timestamp
    """
    from datetime import datetime
    return datetime.now().isoformat()
