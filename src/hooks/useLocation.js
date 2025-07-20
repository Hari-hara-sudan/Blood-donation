import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { Platform, Linking } from 'react-native';

export const useLocation = () => {
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  const checkLocationPermissions = async () => {
    try {
      const serviceEnabled = await Location.hasServicesEnabledAsync();

      if (!serviceEnabled) {
        setLocationError('Location services are disabled');
        return false;
      }

      const { status: foregroundStatus } = await Location.getForegroundPermissionsAsync();
      
      if (foregroundStatus !== 'granted') {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationError('Location permission is required');
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Permission check error:', error);
      setLocationError('Failed to check location permissions');
      return false;
    }
  };

  const getCurrentLocation = async () => {
    try {
      const hasPermission = await checkLocationPermissions();
      if (!hasPermission) return;

      // Try getting last known location first
      const lastLocation = await Location.getLastKnownPositionAsync();
      if (lastLocation) {
        setLocation(lastLocation);
      }

      // Get current location with timeout
      const locationPromise = Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5000,
        distanceInterval: 0
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Location request timeout')), 15000);
      });

      const currentLocation = await Promise.race([locationPromise, timeoutPromise]);
      setLocation(currentLocation);
      setLocationError(null);

    } catch (error) {
      console.error('Location error:', error);
      // Try with low accuracy if high accuracy fails
      try {
        const lowAccuracyLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Low,
          timeInterval: 5000
        });
        setLocation(lowAccuracyLocation);
        setLocationError(null);
      } catch (lowAccError) {
        console.error('Low accuracy location error:', lowAccError);
        setLocationError('Unable to get location. Please check settings.');
      }
    }
  };

  useEffect(() => {
    getCurrentLocation();

    // Start location updates
    let locationSubscription;
    const startLocationUpdates = async () => {
      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 10000,
          distanceInterval: 10
        },
        (newLocation) => {
          setLocation(newLocation);
        }
      );
    };

    startLocationUpdates();

    // Cleanup
    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [retryCount]);

  const retryLocation = () => {
    setRetryCount(prev => prev + 1);
  };

  const openLocationSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  return {
    location,
    locationError,
    retryLocation,
    openLocationSettings,
    getCurrentLocation
  };
};