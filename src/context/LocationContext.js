import React, { createContext, useState, useEffect } from 'react';
import * as Location from 'expo-location';

export const LocationContext = createContext();

export const LocationProvider = ({ children }) => {
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      console.log('Location obtained:', location);
      setLocation(location);
    } catch (error) {
      console.error('Location error:', error);
      setErrorMsg(error.message);
    }
  };

  useEffect(() => {
    getLocation();
  }, []);

  const value = {
    location,
    errorMsg,
    refreshLocation: getLocation
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
};