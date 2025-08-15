import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Linking,
  Dimensions,
  StatusBar,
  Animated,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import polyline from '@mapbox/polyline';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase/config';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';

const { width, height } = Dimensions.get('window');

const MapScreen = ({ route, navigation }) => {
  const mapRef = useRef(null);
  const [userLocation, setUserLocation] = useState(null);
  const [hospitalCoords, setHospitalCoords] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [routeCoords, setRouteCoords] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  
  // New navigation states
  const [navigationMode, setNavigationMode] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [directions, setDirections] = useState([]);
  const [remainingDistance, setRemainingDistance] = useState('');
  const [remainingTime, setRemainingTime] = useState('');
  const [nextInstruction, setNextInstruction] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  // Get request details from navigation params
  const requestData = route?.params?.requestData || null;
  const requestId = route?.params?.requestId || null;
  
  const [fetchedRequestData, setFetchedRequestData] = useState(null);
  
  // Use either passed requestData or fetched data
  const currentRequestData = requestData || fetchedRequestData || {};
  const {
    address: hospitalAddress = currentRequestData.hospitalAddress || '',
    hospital: hospitalName = 'Hospital',
    patientName = '',
    bloodGroup: bloodType = '',
    urgency = 'routine',
    contact: contactNumber = '',
    location: savedLocation = null,
  } = currentRequestData;

  // Fetch request data if only requestId is provided
  useEffect(() => {
    const fetchRequestData = async () => {
      if (requestId && !requestData) {
        try {
          setLoading(true);
          const requestDoc = await getDoc(doc(db, 'requests', requestId));
          if (requestDoc.exists()) {
            setFetchedRequestData({ id: requestDoc.id, ...requestDoc.data() });
          } else {
            setErrorMsg('Request not found');
          }
        } catch (error) {
          console.error('Error fetching request:', error);
          setErrorMsg('Error loading request data');
        } finally {
          setLoading(false);
        }
      }
    };
    
    fetchRequestData();
  }, [requestId, requestData]);

  useEffect(() => {
    if (hospitalAddress) {
      initializeMap();
    }
  }, [hospitalAddress]);

  // Location tracking for navigation
  useEffect(() => {
    let locationSubscription;
    
    if (navigationMode) {
      const startLocationTracking = async () => {
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 1000,
            distanceInterval: 5,
          },
          (location) => {
            setUserLocation(location.coords);
            updateNavigationProgress(location.coords);
          }
        );
      };
      
      startLocationTracking();
    }
    
    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [navigationMode, currentStep]);

  const initializeMap = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      
      console.log('=== MapScreen Debug Info ===');
      console.log('RequestId:', requestId);
      console.log('RequestData:', requestData);
      console.log('FetchedRequestData:', fetchedRequestData);
      console.log('CurrentRequestData:', currentRequestData);
      console.log('Hospital Address:', hospitalAddress);
      console.log('Hospital Name:', hospitalName);

      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Location permission is required to show directions');
        setLoading(false);
        return;
      }

      // Get user's current location
      const userLoc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeout: 15000,
        maximumAge: 60000,
      });
      
      setUserLocation(userLoc.coords);

      // First check if we have saved location coordinates
      if (savedLocation && savedLocation.latitude && savedLocation.longitude) {
        console.log('Using saved location coordinates:', savedLocation);
        setHospitalCoords(savedLocation);
        await getDirections(userLoc.coords, savedLocation);
        
        // Fit map to show both locations
        setTimeout(() => {
          if (mapRef.current && !navigationMode) {
            mapRef.current.fitToCoordinates(
              [userLoc.coords, savedLocation],
              {
                edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                animated: true,
              }
            );
          }
        }, 1000);
        
      } else if (hospitalAddress && hospitalAddress.trim() !== '') {
        // Fallback to geocoding if no saved coordinates
        console.log('No saved coordinates, geocoding address:', hospitalAddress);
        await geocodeHospitalAndGetDirections(userLoc.coords);
      } else {
        setErrorMsg(`Hospital location not available. Request data: ${JSON.stringify(currentRequestData)}`);
      }
    } catch (error) {
      console.error('Error initializing map:', error);
      setErrorMsg(`Error getting location: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const geocodeHospitalAndGetDirections = async (userCoords) => {
    try {
      // Geocode hospital address
      const geocodeResult = await Location.geocodeAsync(hospitalAddress);
      
      if (geocodeResult.length === 0) {
        setErrorMsg(`Could not find location for: ${hospitalAddress}`);
        return;
      }

      const hospitalLocation = {
        latitude: geocodeResult[0].latitude,
        longitude: geocodeResult[0].longitude,
      };
      
      setHospitalCoords(hospitalLocation);

      // Get directions
      await getDirections(userCoords, hospitalLocation);
      
      // Fit map to show both locations
      setTimeout(() => {
        if (mapRef.current && !navigationMode) {
          mapRef.current.fitToCoordinates(
            [userCoords, hospitalLocation],
            {
              edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
              animated: true,
            }
          );
        }
      }, 1000);
    } catch (error) {
      console.error('Error geocoding hospital:', error);
      setErrorMsg('Error finding hospital location');
    }
  };

  const getDirections = async (origin, destination) => {
    try {
      const apiKey = 'AIzaSyBlB34GJNGbRexESR9zILOTx7s5mcIPhkE';
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&key=${apiKey}&mode=driving&traffic_model=best_guess&departure_time=now`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'OK' && data.routes.length > 0) {
        const route = data.routes[0];
        const leg = route.legs[0];
        
        // Decode polyline
        const points = route.overview_polyline.points;
        const coords = polyline.decode(points).map(([lat, lng]) => ({
          latitude: lat,
          longitude: lng,
        }));
        
        setRouteCoords(coords);
        setRouteInfo({
          distance: leg.distance.text,
          duration: leg.duration.text,
          durationInTraffic: leg.duration_in_traffic?.text || leg.duration.text,
        });

        // Store step-by-step directions
        setDirections(leg.steps);
        if (leg.steps.length > 0) {
          setNextInstruction(leg.steps[0].html_instructions.replace(/<[^>]*>/g, ''));
          setRemainingDistance(leg.distance.text);
          setRemainingTime(leg.duration_in_traffic?.text || leg.duration.text);
        }
      } else {
        setErrorMsg(data.error_message || 'Could not find route to hospital');
      }
    } catch (error) {
      console.error('Error getting directions:', error);
      setErrorMsg('Error getting directions');
    }
  };

  const updateNavigationProgress = (currentLocation) => {
    if (!directions.length || !hospitalCoords || !hospitalCoords.latitude || !hospitalCoords.longitude) return;

    // Calculate distance to destination
    const distanceToDestination = calculateDistance(
      currentLocation.latitude,
      currentLocation.longitude,
      hospitalCoords.latitude,
      hospitalCoords.longitude
    );

    // Check if arrived (within 50 meters)
    if (distanceToDestination < 0.05) {
      handleArrival();
      return;
    }

    // Update remaining distance/time estimates
    const estimatedTime = Math.ceil(distanceToDestination * 2); // rough estimate
    setRemainingDistance(`${distanceToDestination.toFixed(1)} km`);
    setRemainingTime(`${estimatedTime} min`);

    // Check if need to move to next instruction
    if (currentStep < directions.length - 1) {
      const nextStep = directions[currentStep + 1];
      if (nextStep && nextStep.start_location) {
        const distanceToNextStep = calculateDistance(
          currentLocation.latitude,
          currentLocation.longitude,
          nextStep.start_location.lat,
          nextStep.start_location.lng
        );

        // If within 100 meters of next instruction, advance
        if (distanceToNextStep < 0.1) {
          setCurrentStep(currentStep + 1);
          const instruction = nextStep.html_instructions.replace(/<[^>]*>/g, '');
          setNextInstruction(instruction);
          
          if (voiceEnabled) {
            Speech.speak(instruction, {
              language: 'en-US',
              pitch: 1.0,
              rate: 0.8
            });
          }
        }
      }
    }
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const handleStartInAppNavigation = () => {
    if (!hospitalCoords || !directions.length) {
      Alert.alert('Error', 'Route information not available');
      return;
    }

    Alert.alert(
      'Start In-App Navigation',
      'Begin turn-by-turn navigation within the app?',
      [
        {
          text: 'Start Navigation',
          onPress: () => {
            setNavigationMode(true);
            setCurrentStep(0);
            
            // Center map on user location
            if (mapRef.current && userLocation) {
              mapRef.current.animateToRegion({
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }, 1000);
            }

            // Speak first instruction
            if (voiceEnabled && directions[0]) {
              const instruction = directions[0].html_instructions.replace(/<[^>]*>/g, '');
              Speech.speak(`Navigation started. ${instruction}`, {
                language: 'en-US',
                pitch: 1.0,
                rate: 0.8
              });
            }
          },
        },
        {
          text: 'External Maps',
          onPress: () => handleStartNavigation(),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const handleStopNavigation = () => {
    Alert.alert(
      'Stop Navigation',
      'Are you sure you want to stop navigation?',
      [
        {
          text: 'Stop',
          onPress: () => {
            setNavigationMode(false);
            setCurrentStep(0);
            Speech.stop();
            
            // Reset map view
            if (mapRef.current && userLocation && hospitalCoords) {
              mapRef.current.fitToCoordinates(
                [userLocation, hospitalCoords],
                {
                  edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
                  animated: true,
                }
              );
            }
          },
        },
        {
          text: 'Continue',
          style: 'cancel',
        },
      ]
    );
  };

  const handleArrival = () => {
    setNavigationMode(false);
    Speech.speak('You have arrived at your destination. Thank you for your blood donation!', {
      language: 'en-US',
      pitch: 1.0,
      rate: 0.8
    });
    
    Alert.alert(
      '🎉 Arrived!',
      'You have reached the hospital. Thank you for your life-saving donation!',
      [
        {
          text: 'Call Hospital',
          onPress: () => handleCallHospital(),
        },
        {
          text: 'Done',
          onPress: () => navigation.goBack(),
        },
      ]
    );
  };

  const handleStartNavigation = () => {
    if (!hospitalCoords) return;
    
    Alert.alert(
      'External Navigation',
      'Choose your preferred navigation app:',
      [
        {
          text: 'Google Maps',
          onPress: () => openGoogleMaps(),
        },
        {
          text: 'Apple Maps',
          onPress: () => openAppleMaps(),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const openGoogleMaps = () => {
    if (!hospitalCoords || !hospitalCoords.latitude || !hospitalCoords.longitude) {
      Alert.alert('Error', 'Hospital location not available');
      return;
    }
    const url = `https://www.google.com/maps/dir/?api=1&destination=${hospitalCoords.latitude},${hospitalCoords.longitude}&travelmode=driving`;
    Linking.openURL(url);
  };

  const openAppleMaps = () => {
    if (!hospitalCoords || !hospitalCoords.latitude || !hospitalCoords.longitude) {
      Alert.alert('Error', 'Hospital location not available');
      return;
    }
    const url = `http://maps.apple.com/?daddr=${hospitalCoords.latitude},${hospitalCoords.longitude}&dirflg=d`;
    Linking.openURL(url);
  };

  const handleCallHospital = () => {
    if (contactNumber) {
      Linking.openURL(`tel:${contactNumber}`);
    } else {
      Alert.alert('Contact Info', 'Hospital contact number not available');
    }
  };

  const handleEmergency = () => {
    Alert.alert(
      'Emergency',
      'Call emergency services?',
      [
        {
          text: 'Call 108',
          onPress: () => Linking.openURL('tel:108'),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  // Custom Donor Marker Component
  const DonorMarker = () => (
    <View style={styles.customMarkerContainer}>
      <View style={styles.donorMarkerShadow} />
      <View style={styles.donorMarkerMain}>
        <LinearGradient
          colors={['#ff6f61', '#ffb199']}
          style={styles.donorMarkerGradient}
        >
          <Ionicons name="person" size={24} color="white" />
        </LinearGradient>
        <View style={styles.donorMarkerPulse} />
      </View>
      <View style={styles.markerTail} />
    </View>
  );

  // Custom Hospital Marker Component
  const HospitalMarker = () => (
    <View style={styles.customMarkerContainer}>
      <View style={styles.hospitalMarkerShadow} />
      <View style={styles.hospitalMarkerMain}>
        <LinearGradient
          colors={['#ff5252', '#ff6f61']}
          style={styles.hospitalMarkerGradient}
        >
          <View style={styles.hospitalCross}>
            <View style={styles.crossVertical} />
            <View style={styles.crossHorizontal} />
          </View>
        </LinearGradient>
        <View style={styles.hospitalMarkerPulse} />
      </View>
      <View style={styles.markerTail} />
    </View>
  );

  const donorName = "Hari";

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={['#ff6f61', '#ffb199']}
          style={styles.loadingGradient}
        >
          <View style={styles.loadingContent}>
            <View style={styles.loadingSpinner}>
              <ActivityIndicator size="large" color="white" />
            </View>
            <Text style={styles.loadingText}>Finding Your Route</Text>
            <Text style={styles.loadingSubText}>Connecting to hospital location...</Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  if (errorMsg) {
    return (
      <View style={styles.errorContainer}>
        <LinearGradient
          colors={['#ff5252', '#ff6f61']}
          style={styles.errorGradient}
        >
          <View style={styles.errorContent}>
            <View style={styles.errorIcon}>
              <Ionicons name="warning-outline" size={64} color="white" />
            </View>
            <Text style={styles.errorTitle}>Navigation Error</Text>
            <Text style={styles.errorText}>{errorMsg}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={initializeMap}>
              <LinearGradient
                colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']}
                style={styles.retryButtonGradient}
              >
                <Ionicons name="refresh" size={20} color="white" />
                <Text style={styles.retryButtonText}>Try Again</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  }

  // Don't render map until we have user location
  if (!userLocation) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={['#ff6f61', '#ffb199']}
          style={styles.loadingGradient}
        >
          <View style={styles.loadingContent}>
            <View style={styles.loadingSpinner}>
              <ActivityIndicator size="large" color="white" />
            </View>
            <Text style={styles.loadingText}>Getting Your Location</Text>
            <Text style={styles.loadingSubText}>Please enable location permissions...</Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Navigation Header or Regular Header */}
      {navigationMode ? (
        <View style={styles.navigationHeader}>
          <LinearGradient
            colors={['#ff5252', '#ff6f61']}
            style={styles.navigationHeaderGradient}
          >
            <View style={styles.navigationInfo}>
              <View style={styles.navigationTop}>
                <Text style={styles.remainingTime}>{remainingTime}</Text>
                <Text style={styles.remainingDistance}>{remainingDistance}</Text>
                <TouchableOpacity 
                  style={styles.voiceToggle}
                  onPress={() => setVoiceEnabled(!voiceEnabled)}
                >
                  <Ionicons 
                    name={voiceEnabled ? "volume-high" : "volume-mute"} 
                    size={20} 
                    color="white" 
                  />
                </TouchableOpacity>
              </View>
              <Text style={styles.navigationInstruction}>{nextInstruction}</Text>
            </View>
            <TouchableOpacity 
              style={styles.stopNavigationButton}
              onPress={handleStopNavigation}
            >
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          </LinearGradient>
        </View>
      ) : (
        <View style={styles.headerGlass}>
          <LinearGradient
            colors={['#ff6f61', '#fff5f5']}
            style={styles.headerGradient}
          >
            <Text style={styles.headerHello}>Hi, {donorName} 👋</Text>
            <Text style={styles.headerMsg}>Thank you for being a lifesaver!</Text>
          </LinearGradient>
        </View>
      )}

      {/* Map View */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation
        showsCompass
        showsTraffic
      >
        {/* Custom User Marker */}
        <Marker coordinate={userLocation} title="You">
          <View style={styles.userMarkerOuter}>
            <View style={styles.userMarkerInner} />
          </View>
        </Marker>
        {/* Custom Hospital Marker */}
        {hospitalCoords && (
          <Marker coordinate={hospitalCoords} title={hospitalName} description={hospitalAddress}>
            <View style={styles.hospitalMarkerOuter}>
              <Ionicons name="medkit" size={24} color="#fff" />
            </View>
          </Marker>
        )}
        {routeCoords.length > 0 && (
          <Polyline coordinates={routeCoords} strokeColor="#1976D2" strokeWidth={5} />
        )}
      </MapView>

      {/* Info Panel (hidden during navigation) */}
      {!navigationMode && (
        <View style={styles.infoPanel}>
          <LinearGradient
            colors={['#fff5f5', '#ffffff']}
            style={styles.infoPanelGradient}
          >
            <View style={styles.infoPanelHeader}>
              <View style={styles.urgencyContainer}>
                <View style={[
                  styles.urgencyBadge,
                  { backgroundColor: urgency === 'Critical' ? '#ff5252' : urgency === 'Urgent' ? '#ffb199' : '#ff6f61' }
                ]}>
                  <Text style={styles.urgencyText}>
                    {urgency?.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.bloodTypeContainer}>
                  <Text style={styles.bloodTypeText}>{bloodType}</Text>
                  <Ionicons name="water" size={16} color="#ff6f61" />
                </View>
              </View>
            </View>
            <View style={styles.patientInfo}>
              <View style={styles.infoRow}>
                <Ionicons name="person-outline" size={16} color="#666" />
                <Text style={styles.patientText}>{patientName || 'Anonymous Patient'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="medical-outline" size={16} color="#666" />
                <Text style={styles.hospitalText}>{hospitalName}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>
      )}

      {/* Route Info Panel (hidden during navigation) */}
      {routeInfo && !navigationMode && (
        <View style={styles.routePanel}>
          <LinearGradient
            colors={['#fff5f5', '#ffffff']}
            style={styles.routePanelGradient}
          >
            <View style={styles.routeHeader}>
              <Ionicons name="navigate" size={16} color="#ff6f61" />
              <Text style={styles.routeTitle}>Route Information</Text>
            </View>
            <View style={styles.routeDetails}>
              <View style={styles.routeInfoItem}>
                <View style={styles.routeIconContainer}>
                  <Ionicons name="time" size={14} color="#ff6f61" />
                </View>
                <Text style={styles.routeInfoText}>{routeInfo.durationInTraffic}</Text>
              </View>
              <View style={styles.routeInfoItem}>
                <View style={styles.routeIconContainer}>
                  <Ionicons name="location" size={14} color="#ffb199" />
                </View>
                <Text style={styles.routeInfoText}>{routeInfo.distance}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.primaryActionButton}
          onPress={navigationMode ? handleStopNavigation : handleStartInAppNavigation}
          disabled={!hospitalCoords}
        >
          <LinearGradient
            colors={hospitalCoords ? 
              (navigationMode ? ['#ff5252', '#ff6f61'] : ['#ff6f61', '#ffb199']) : 
              ['#ccc', '#999']
            }
            style={styles.actionButtonGradient}
          >
            <Ionicons 
              name={navigationMode ? "stop" : "navigate"} 
              size={24} 
              color="white" 
            />
            <Text style={styles.primaryActionText}>
              {navigationMode ? 'Stop Navigation' : 'Start Navigation'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.secondaryActions}>
          <TouchableOpacity
            style={styles.secondaryActionButton}
            onPress={handleCallHospital}
          >
            <LinearGradient
              colors={['#ff6f61', '#ffb199']}
              style={styles.secondaryButtonGradient}
            >
              <Ionicons name="call" size={20} color="white" />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryActionButton}
            onPress={handleEmergency}
          >
            <LinearGradient
              colors={['#ff5252', '#ff6f61']}
              style={styles.secondaryButtonGradient}
            >
              <Ionicons name="medical" size={20} color="white" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {/* My Location Button (hidden during navigation) */}
      {!navigationMode && (
        <TouchableOpacity
          style={styles.myLocationButton}
          onPress={() => {
            if (mapRef.current && userLocation) {
              mapRef.current.animateToRegion({
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              });
            }
          }}
        >
          <LinearGradient
            colors={['#fff5f5', '#ffb199']}
            style={styles.myLocationGradient}
          >
            <Ionicons name="locate" size={24} color="#ff6f61" />
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  map: {
    flex: 1,
  },

  // Navigation Header Styles
  navigationHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingTop: 50,
  },
  navigationHeaderGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  navigationInfo: {
    flex: 1,
  },
  navigationTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  remainingTime: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginRight: 16,
  },
  remainingDistance: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    marginRight: 16,
  },
  voiceToggle: {
    marginLeft: 'auto',
    padding: 8,
  },
  navigationInstruction: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.95)',
    fontWeight: '500',
  },
  stopNavigationButton: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
  },

  // Regular Header Styles
  headerGlass: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 14,
  },
  headerGradient: {
    width: '92%',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    alignItems: 'flex-start',
  },
  headerHello: {
    fontSize: 20,
    color: 'white',
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  headerMsg: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.92)',
    fontWeight: '500',
    letterSpacing: 0.1,
  },

  // Loading Styles
  loadingContainer: {
    flex: 1,
  },
  loadingGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
    padding: 40,
  },
  loadingSpinner: {
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 22,
    fontWeight: '700',
    color: 'white',
    marginBottom: 8,
    textAlign: 'center',
  },
  loadingSubText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: 30,
  },

  // Error Styles
  errorContainer: {
    flex: 1,
  },
  errorGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContent: {
    alignItems: 'center',
    padding: 40,
  },
  errorIcon: {
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  retryButton: {
    borderRadius: 25,
    overflow: 'hidden',
  },
  retryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 25,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },

  // Custom Marker Styles
  customMarkerContainer: {
    alignItems: 'center',
  },
  
  // Donor Marker
  donorMarkerShadow: {
    position: 'absolute',
    top: 2,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.2)',
    transform: [{ scaleX: 0.8 }, { scaleY: 0.3 }],
  },
  donorMarkerMain: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
    position: 'relative',
  },
  donorMarkerGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  donorMarkerPulse: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: 'rgba(255, 111, 97, 0.3)',
  },
  
  // Hospital Marker
  hospitalMarkerShadow: {
    position: 'absolute',
    top: 2,
    width: 55,
    height: 55,
    borderRadius: 27.5,
    backgroundColor: 'rgba(0,0,0,0.2)',
    transform: [{ scaleX: 0.8 }, { scaleY: 0.3 }],
  },
  hospitalMarkerMain: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
    position: 'relative',
  },
  hospitalMarkerGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 24.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hospitalMarkerPulse: {
    position: 'absolute',
    width: 65,
    height: 65,
    borderRadius: 32.5,
    borderWidth: 2,
    borderColor: 'rgba(255, 82, 82, 0.3)',
  },
  hospitalCross: {
    width: 20,
    height: 20,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  crossVertical: {
    position: 'absolute',
    width: 3,
    height: 16,
    backgroundColor: 'white',
    borderRadius: 1.5,
  },
  crossHorizontal: {
    position: 'absolute',
    width: 16,
    height: 3,
    backgroundColor: 'white',
    borderRadius: 1.5,
  },
  
  // Marker Tail
  markerTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'white',
    marginTop: -3,
  },

  // Info Panel Styles
  infoPanel: {
    position: 'absolute',
    top: 140,
    left: 16,
    right: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  infoPanelGradient: {
    padding: 20,
  },
  infoPanelHeader: {
    marginBottom: 16,
  },
  urgencyContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  urgencyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  urgencyText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
  },
  bloodTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 111, 97, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  bloodTypeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ff6f61',
    marginRight: 4,
  },
  patientInfo: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  patientText: {
    fontSize: 15,
    color: '#444',
    marginLeft: 8,
    fontWeight: '500',
  },
  hospitalText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '600',
    marginLeft: 8,
  },

  // Route Panel Styles
  routePanel: {
    position: 'absolute',
    top: 300,
    left: 16,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  routePanelGradient: {
    padding: 16,
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  routeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginLeft: 6,
  },
  routeDetails: {
    gap: 8,
  },
  routeInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 111, 97, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  routeInfoText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },

  // Action Button Styles
  actionButtons: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
  },
  primaryActionButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  primaryActionText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  secondaryActionButton: {
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  secondaryButtonGradient: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // My Location Button
  myLocationButton: {
    position: 'absolute',
    bottom: 180,
    right: 16,
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },
  myLocationGradient: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 111, 97, 0.2)',
  },

  // New Marker Styles
  userMarkerOuter: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3182CE',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  userMarkerInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
  },
  hospitalMarkerOuter: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E53E3E',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
});

export default MapScreen;