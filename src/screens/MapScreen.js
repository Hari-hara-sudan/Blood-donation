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
import * as Speech from 'expo-speech';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';

// Get environment variables directly from app.config.js extra section
const extra = Constants.expoConfig?.extra || {};

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
  const [navigationSteps, setNavigationSteps] = useState([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Get request details from navigation params
  const requestData = route?.params?.requestData || null;
  const requestId = route?.params?.requestId || null;
  
  const [fetchedRequestData, setFetchedRequestData] = useState(null);
  
  // Use either passed requestData or fetched data
  const currentRequestData = requestData || fetchedRequestData || {};
  const {
    address: hospitalAddress = '',
    hospital: hospitalName = 'Hospital',
    patientName = '',
    bloodGroup: bloodType = '',
    urgency = 'routine',
    contact: contactNumber = '',
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

  const initializeMap = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

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

      // Geocode hospital address if provided
      if (hospitalAddress) {
        await geocodeHospitalAndGetDirections(userLoc.coords);
      } else {
        setErrorMsg('Hospital address not provided');
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
        if (mapRef.current) {
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
      // Use environment variable for Google Maps API key
      const apiKey = extra.GOOGLE_MAPS_API_KEY || 'AIzaSyBlB34GJNGbRexESR9zILOTx7s5mcIPhkE';
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
          ...route,
          distance: leg.distance.text,
          duration: leg.duration.text,
          durationInTraffic: leg.duration_in_traffic?.text || leg.duration.text,
        });
      } else {
        setErrorMsg(data.error_message || 'Could not find route to hospital');
      }
    } catch (error) {
      console.error('Error getting directions:', error);
      setErrorMsg('Error getting directions');
    }
  };

  const handleStartNavigation = () => {
    if (!hospitalCoords || !routeInfo || !routeInfo.legs) return;
    // Gather navigation steps from directions API response
    const steps = routeInfo.legs[0]?.steps || [];
    setNavigationSteps(steps);
    setCurrentStepIndex(0);
    setIsNavigating(true);
  };

  useEffect(() => {
    if (isNavigating && navigationSteps.length > 0) {
      const currentStep = navigationSteps[currentStepIndex];
      if (currentStep?.instruction) {
        Speech.stop();
        Speech.speak(currentStep.instruction, { language: 'en', pitch: 1.1, rate: 1.0 });
      }
    }
    // Stop speech when navigation ends
    if (!isNavigating) {
      Speech.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNavigating, currentStepIndex, navigationSteps]);

  const handleNextStep = () => {
    if (currentStepIndex < navigationSteps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleExitNavigation = () => {
    setIsNavigating(false);
    setCurrentStepIndex(0);
    setNavigationSteps([]);
  };


  const openGoogleMaps = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${hospitalCoords.latitude},${hospitalCoords.longitude}&travelmode=driving`;
    Linking.openURL(url);
  };

  const openAppleMaps = () => {
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


  // Example donor name, replace with actual user context if available
  const donorName = "Hari";

  // --- MAIN RETURN BLOCK ---
  return (
    <View style={styles.container}>
      {/* Floating Glass Header */}
      <View style={styles.headerGlass}>
        <LinearGradient
          colors={['#ff6f61', '#fff5f5']}
          style={styles.headerGradient}
        >
          <Text style={styles.headerHello}>Hi, {donorName} 👋</Text>
          <Text style={styles.headerMsg}>Thank you for being a lifesaver!</Text>
        </LinearGradient>
      </View>
      {/* Map View */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsTraffic={true}
        followsUserLocation={false}
        customMapStyle={[]}
        initialRegion={{
          latitude: userLocation?.latitude || 13.0827,
          longitude: userLocation?.longitude || 80.2707,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
      >
        {/* User Location Marker */}
        {userLocation && (
          <Marker
            coordinate={{
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
            }}
            title="Your Location"
            description="Blood Donor"
            anchor={{ x: 0.5, y: 1 }}
          />
        )}
        {/* Hospital Marker */}
        {hospitalCoords && (
          <Marker
            coordinate={hospitalCoords}
            title={hospitalName}
            description={hospitalAddress}
            anchor={{ x: 0.5, y: 1 }}
          />
        )}
        {/* Route Polyline */}
        {routeCoords.length > 0 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor="#ff6f61"
            strokeWidth={5}
            strokePattern={[1, 0]}
            lineCap="round"
            lineJoin="round"
          />
        )}
      </MapView>
      {/* Enhanced Info Panel */}
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
      {/* Enhanced Route Info Panel */}
      {routeInfo && (
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
      {/* Enhanced Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.primaryActionButton}
          onPress={handleStartNavigation}
          disabled={!hospitalCoords || isNavigating}
        >
          <LinearGradient
            colors={hospitalCoords && !isNavigating ? ['#ff6f61', '#ffb199'] : ['#ccc', '#999']}
            style={styles.actionButtonGradient}
          >
            <Ionicons name="navigate" size={24} color="white" />
            <Text style={styles.primaryActionText}>{isNavigating ? 'Navigating...' : 'Start Navigation'}</Text>
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
      {/* In-App Navigation Panel */}
      {isNavigating && navigationSteps.length > 0 && (
        <View style={styles.navigationPanel}>
          <View style={styles.navigationHeader}>
            <Text style={styles.navigationTitle}>Turn-by-Turn Navigation</Text>
            <TouchableOpacity onPress={handleExitNavigation} style={styles.exitNavButton}>
              <Ionicons name="close" size={22} color="#ff6f61" />
            </TouchableOpacity>
          </View>
          <View style={styles.navigationStepBox}>
            <Text style={styles.navigationStepText}>
              Step {currentStepIndex + 1} of {navigationSteps.length}
            </Text>
            <Text style={styles.navigationInstruction}>
              {navigationSteps[currentStepIndex]?.html_instructions?.replace(/<[^>]+>/g, '')}
            </Text>
            <Text style={styles.navigationDistance}>
              {navigationSteps[currentStepIndex]?.distance?.text} • {navigationSteps[currentStepIndex]?.duration?.text}
            </Text>
          </View>
          <View style={styles.navigationStepControls}>
            <TouchableOpacity
              onPress={handlePrevStep}
              disabled={currentStepIndex === 0}
              style={[styles.navStepButton, currentStepIndex === 0 && { opacity: 0.5 }]}
            >
              <Ionicons name="arrow-back" size={20} color="#ff6f61" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleNextStep}
              disabled={currentStepIndex === navigationSteps.length - 1}
              style={[styles.navStepButton, currentStepIndex === navigationSteps.length - 1 && { opacity: 0.5 }]}
            >
              <Ionicons name="arrow-forward" size={20} color="#ff6f61" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Enhanced My Location Button */}
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
    </View>
  );

}


const styles = StyleSheet.create({
  // Floating Glass Header Styles
  headerGlass: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    alignItems: 'center',
    paddingTop: 38,
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

  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  map: {
    flex: 1,
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
  loadingDots: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.6)',
    marginHorizontal: 4,
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
    borderColor: 'rgba(78, 205, 196, 0.3)',
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
    borderColor: 'rgba(255, 107, 107, 0.3)',
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
    top: 60,
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
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  bloodTypeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF6B6B',
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
    top: 220,
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
    backgroundColor: 'rgba(78, 205, 196, 0.1)',
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
    borderColor: 'rgba(255, 107, 107, 0.2)',
  },
});

export default MapScreen;