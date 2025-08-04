import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase/config';

// Helper to calculate ETA using Haversine formula and average speed (km/h)
function calculateETA(from, to, avgSpeedKmh = 40) {
  if (!from || !to) return null;
  const toRad = (val) => (val * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(to.latitude - from.latitude);
  const dLon = toRad(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(from.latitude)) * Math.cos(toRad(to.latitude)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // in km
  const etaMinutes = distance / avgSpeedKmh * 60;
  return { distance: distance.toFixed(2), eta: Math.round(etaMinutes) };
}

import * as Location from 'expo-location';

import { Alert, Linking } from 'react-native';
const DonorTrackingScreen = ({ route, navigation }) => {
  const { requestId, hospitalCoords, donors: passedDonors, selectedDonor } = route.params || {};
  const [donors, setDonors] = useState(passedDonors || []); // Array of donors who accepted
  
  // Debug log to check if donor details are being passed correctly
  useEffect(() => {
    console.log('DonorTrackingScreen - Passed donors:', passedDonors);
    console.log('DonorTrackingScreen - Selected donor:', selectedDonor);
    console.log('DonorTrackingScreen - Current donors state:', donors);
  }, [passedDonors, selectedDonor, donors]);
  const [donorLocations, setDonorLocations] = useState({}); // Object with donorId as key
  const [donorAddresses, setDonorAddresses] = useState({}); // Object with donorId as key
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timer, setTimer] = useState(null); // seconds
  const [timerActive, setTimerActive] = useState(false);
  const [endTime, setEndTime] = useState(null); // timestamp in ms
  const [endTimeInitialized, setEndTimeInitialized] = useState(false); // ensure timer is set only once
  const [showPrompt, setShowPrompt] = useState(false);
  const [finalCallEnabled, setFinalCallEnabled] = useState(false);
  const [donationCompleted, setDonationCompleted] = useState(false);

  // Subscribe to all request fields (location, donorTrackingEndTime, etc.)
  useEffect(() => {
    if (!requestId) {
      setError('Request ID not provided');
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      doc(db, 'requests', requestId),
      async (snap) => {
        const data = snap.data();
        if (!data) return;
        
        // Get all donors who accepted this request
        const acceptedDonors = Array.isArray(data.donors) ? data.donors : [];
        
        // Only update donors if we don't have detailed donor info from navigation
        if (!passedDonors || passedDonors.length === 0) {
          setDonors(acceptedDonors);
        }
        // If we have passed donors, merge with any new acceptances
        else {
          // Keep the detailed donor info but update with any new donors
          const existingDonorIds = passedDonors.map(d => d.userId);
          const newDonors = acceptedDonors.filter(d => !existingDonorIds.includes(d.userId));
          if (newDonors.length > 0) {
            setDonors([...passedDonors, ...newDonors]);
          }
        }
        
        // Handle donor locations (could be multiple donors)
        if (data.donorLocations) {
          // Multiple donor locations object
          setDonorLocations(data.donorLocations);
          
          // Reverse geocode all donor locations
          const addresses = {};
          for (const [donorId, location] of Object.entries(data.donorLocations)) {
            if (location.latitude && location.longitude) {
              try {
                const addrArr = await Location.reverseGeocodeAsync({
                  latitude: location.latitude,
                  longitude: location.longitude
                });
                if (addrArr && addrArr.length > 0) {
                  const addr = addrArr[0];
                  // Build detailed address with all available components
                  const addressParts = [
                    addr.streetNumber,
                    addr.street,
                    addr.name, // Building/landmark name
                    addr.district,
                    addr.subregion,
                    addr.city,
                    addr.region,
                    addr.postalCode
                  ].filter(Boolean);
                  
                  // Create a more readable format
                  let detailedAddress = '';
                  if (addr.streetNumber && addr.street) {
                    detailedAddress = `${addr.streetNumber} ${addr.street}`;
                  } else if (addr.street) {
                    detailedAddress = addr.street;
                  }
                  
                  if (addr.name && addr.name !== addr.street) {
                    detailedAddress += detailedAddress ? `, ${addr.name}` : addr.name;
                  }
                  
                  if (addr.district && addr.district !== addr.city) {
                    detailedAddress += detailedAddress ? `, ${addr.district}` : addr.district;
                  }
                  
                  if (addr.city) {
                    detailedAddress += detailedAddress ? `, ${addr.city}` : addr.city;
                  }
                  
                  if (addr.region && addr.region !== addr.city) {
                    detailedAddress += detailedAddress ? `, ${addr.region}` : addr.region;
                  }
                  
                  if (addr.postalCode) {
                    detailedAddress += detailedAddress ? ` - ${addr.postalCode}` : addr.postalCode;
                  }
                  
                  addresses[donorId] = detailedAddress || addressParts.join(', ');
                }
              } catch (e) {
                addresses[donorId] = null;
              }
            }
          }
          setDonorAddresses(addresses);
          setLastUpdated(new Date());
        } else if (data.donorLocation) {
          // Legacy single donor location support
          const firstDonor = acceptedDonors[0];
          if (firstDonor) {
            setDonorLocations({ [firstDonor.userId]: data.donorLocation });
            setLastUpdated(data.donorLocation.updatedAt?.toDate ? data.donorLocation.updatedAt.toDate() : new Date());
            
            if (data.donorLocation.latitude && data.donorLocation.longitude) {
              Location.reverseGeocodeAsync({
                latitude: data.donorLocation.latitude,
                longitude: data.donorLocation.longitude
              }).then(addrArr => {
                if (addrArr && addrArr.length > 0) {
                  const addr = addrArr[0];
                  // Build detailed address with all available components
                  let detailedAddress = '';
                  if (addr.streetNumber && addr.street) {
                    detailedAddress = `${addr.streetNumber} ${addr.street}`;
                  } else if (addr.street) {
                    detailedAddress = addr.street;
                  }
                  
                  if (addr.name && addr.name !== addr.street) {
                    detailedAddress += detailedAddress ? `, ${addr.name}` : addr.name;
                  }
                  
                  if (addr.district && addr.district !== addr.city) {
                    detailedAddress += detailedAddress ? `, ${addr.district}` : addr.district;
                  }
                  
                  if (addr.city) {
                    detailedAddress += detailedAddress ? `, ${addr.city}` : addr.city;
                  }
                  
                  if (addr.region && addr.region !== addr.city) {
                    detailedAddress += detailedAddress ? `, ${addr.region}` : addr.region;
                  }
                  
                  if (addr.postalCode) {
                    detailedAddress += detailedAddress ? ` - ${addr.postalCode}` : addr.postalCode;
                  }
                  
                  const addressParts = [
                    addr.streetNumber,
                    addr.street,
                    addr.name,
                    addr.district,
                    addr.subregion,
                    addr.city,
                    addr.region,
                    addr.postalCode
                  ].filter(Boolean);
                  
                  setDonorAddresses({ [firstDonor.userId]: detailedAddress || addressParts.join(', ') });
                }
              }).catch(() => setDonorAddresses({ [firstDonor.userId]: null }));
            }
          }
        }
        // Timer persistence logic (robust)
        if (data.donorTrackingEndTime) {
          setEndTime(data.donorTrackingEndTime);
          setTimerActive(true);
          setEndTimeInitialized(true);
        } else if (
          !donationCompleted &&
          !endTimeInitialized &&
          data.donorLocation && hospitalCoords &&
          calculateETA(data.donorLocation, hospitalCoords)?.eta > 0
        ) {
          // Only set if NOT present in Firestore and not already set locally
          // Use first donor's location for timer calculation
          const firstDonorLocation = Object.values(donorLocations)[0] || data.donorLocation;
          if (firstDonorLocation) {
            const eta = calculateETA(firstDonorLocation, hospitalCoords).eta;
            const now = Date.now();
            const calculatedEnd = now + (eta + 10) * 60 * 1000;
            setEndTime(calculatedEnd);
            setTimerActive(true);
            setEndTimeInitialized(true);
            // Save to Firestore so it's persistent
            await updateDoc(doc(db, 'requests', requestId), { donorTrackingEndTime: calculatedEnd });
          }
        }
        setLoading(false);
      },
      (err) => {
        setError('Could not fetch donor location');
        setLoading(false);
      }
    );
    return () => unsub();
  }, [requestId, donationCompleted, hospitalCoords, endTimeInitialized]);

  // Calculate ETA
  const etaInfo = donorLocation && hospitalCoords
    ? calculateETA(donorLocation, hospitalCoords)
    : null;

  useEffect(() => {
    let interval;
    if (timerActive && endTime && !donationCompleted) {
      const updateTimer = () => {
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
        setTimer(remaining);
        if (remaining <= 0) {
          setTimerActive(false);
          setShowPrompt(true);
        }
      };
      updateTimer(); // initial call
      interval = setInterval(updateTimer, 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive, endTime, donationCompleted]);

  // Helper to format time as mm:ss
  const formatTime = (seconds) => {
    if (seconds === null || seconds === undefined) return '--:--';
    const mm = Math.floor(seconds / 60).toString().padStart(2, '0');
    const ss = Math.max(0, seconds % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  };

  // Prompt logic
  useEffect(() => {
    if (showPrompt) {
      Alert.alert(
        'Has the donor arrived?',
        'Please confirm if the donor has reached the hospital.',
        [
          {
            text: 'Yes',
            onPress: async () => {
              setDonationCompleted(true);
              setShowPrompt(false);
              // Mark request as completed and update stats
              try {
                const reqRef = doc(db, 'requests', requestId);
                await updateDoc(reqRef, { status: 'completed', completedAt: new Date() });
                // Update stats (increment donations)
                const statsRef = doc(db, 'stats', 'global');
                await updateDoc(statsRef, { donations: increment(1) });
                Alert.alert('Thank you!', 'Donation process marked as completed.');
              } catch (e) {
                Alert.alert('Error', 'Failed to update donation status.');
              }
            }
          },
          {
            text: 'No',
            onPress: () => {
              setFinalCallEnabled(true);
              setShowPrompt(false);
            },
            style: 'destructive',
          }
        ],
        { cancelable: false }
      );
    }
  }, [showPrompt]);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Donor Live Location</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#ff6f61" style={{marginTop: 40}} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : donors && donors.length > 0 ? (
        <View style={{width: '100%', alignItems: 'center', flex: 1}}>
          {donors.map((donor) => {
            const donorLoc = donorLocations[donor.userId];
            const donorAddr = donorAddresses[donor.userId];
            const etaInfo = donorLoc && hospitalCoords ? calculateETA(donorLoc, hospitalCoords) : null;
            return (
              <View key={donor.userId} style={styles.infoPanel}>
                <View style={styles.row}>
                  <Ionicons name="person" size={28} color="#ff6f61" style={{marginRight: 8}} />
                  <Text style={styles.label}>{donor.name || 'Donor'}</Text>
                </View>
                <View style={styles.row}>
                  <MaterialIcons name="location-on" size={24} color={donorLoc ? "#4caf50" : "#ff5722"} style={{marginRight: 6}} />
                  <Text style={[styles.value, !donorLoc && styles.noLocationText]}>
                    {donorAddr
                      ? donorAddr
                      : donorLoc && donorLoc.latitude && donorLoc.longitude 
                        ? `Lat: ${donorLoc.latitude.toFixed(5)}, Lng: ${donorLoc.longitude.toFixed(5)}` 
                        : 'Location not available yet'}
                  </Text>
                </View>
                
                {/* Location Status Message */}
                {!donorLoc && (
                  <View style={styles.warningContainer}>
                    <MaterialIcons name="warning" size={20} color="#ff9800" style={{marginRight: 6}} />
                    <Text style={styles.warningText}>
                      Donor hasn't shared location yet. Please ask them to open the map screen.
                    </Text>
                  </View>
                )}
                
                {/* Progress Bar for How Near Donor Is */}
                {etaInfo && etaInfo.distance !== undefined && (
                  <View style={styles.progressBarContainer}>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFg, { width: `${Math.max(0, Math.min(100, 100 - (etaInfo.distance / 10) * 100))}%` }]} />
                    </View>
                    <Text style={styles.progressLabel}>
                      {etaInfo.distance <= 0.2 ? 'Arrived' : 
                       etaInfo.distance < 1 ? 'Very Close' : 
                       etaInfo.distance < 3 ? 'Nearby' : 
                       etaInfo.distance < 7 ? 'On the way' : 'Far'}
                    </Text>
                  </View>
                )}
                
                {etaInfo && etaInfo.eta !== undefined && etaInfo.distance !== undefined && (
                  <View style={styles.row}>
                    <Ionicons name="time" size={22} color="#ff9800" style={{marginRight: 6}} />
                    <Text style={styles.value}>ETA: {etaInfo.eta} min ({etaInfo.distance} km left)</Text>
                  </View>
                )}
                
                {/* No ETA Available Message */}
                {!etaInfo && donorLoc && (
                  <View style={styles.row}>
                    <Ionicons name="time" size={22} color="#ccc" style={{marginRight: 6}} />
                    <Text style={[styles.value, {color: '#999'}]}>ETA: Calculating...</Text>
                  </View>
                )}
                
                {/* Timer Bar (show only for first donor for now) */}
                {timerActive && timer !== null && !donationCompleted && donors[0]?.userId === donor.userId && (
                  <View style={styles.row}>
                    <Ionicons name="timer-outline" size={22} color="#2196f3" style={{marginRight: 6}} />
                    <Text style={styles.value}>Time left: {formatTime(timer)}</Text>
                  </View>
                )}
                
                {/* Final Call Button (show only for first donor for now) */}
                {finalCallEnabled && requestId && donors[0]?.userId === donor.userId && (
                  <TouchableOpacity
                    style={[styles.finalCallBtn, { marginTop: 10 }]}
                    onPress={async () => {
                      try {
                        const donorPhone = donor.phoneNumber;
                        if (donorPhone) Linking.openURL(`tel:${donorPhone}`);
                        else Alert.alert('Error', 'No donor phone found.');
                      } catch {
                        Alert.alert('Error', 'Could not fetch donor info.');
                      }
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Final Call Donor</Text>
                  </TouchableOpacity>
                )}
                
                {/* Donation Complete Message */}
                {donationCompleted && (
                  <Text style={[styles.value, { color: '#4caf50', marginTop: 12 }]}>Donation process completed. Thank you!</Text>
                )}
                
                <Text style={styles.updated}>Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : '-'}</Text>
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={styles.value}>Waiting for donor location update...</Text>
      )}
      <TouchableOpacity style={styles.refreshBtn} onPress={() => setLoading(true)}>
        <Ionicons name="refresh" size={22} color="#fff" />
        <Text style={styles.refreshText}>Refresh</Text>
      </TouchableOpacity>
    </View>
  );

// Prompt logic
useEffect(() => {
  if (showPrompt) {
    Alert.alert(
      'Has the donor arrived?',
      'Please confirm if the donor has reached the hospital.',
      [
        {
          text: 'Yes',
          onPress: async () => {
            setDonationCompleted(true);
            setShowPrompt(false);
            // Mark request as completed and update stats
            try {
              const reqRef = doc(db, 'requests', requestId);
              await updateDoc(reqRef, { status: 'completed', completedAt: new Date() });
              // Update stats (increment donations)
              const statsRef = doc(db, 'stats', 'global');
              await updateDoc(statsRef, { donations: increment(1) });
              Alert.alert('Thank you!', 'Donation process marked as completed.');
            } catch (e) {
              Alert.alert('Error', 'Failed to update donation status.');
            }
          }
        },
        {
          text: 'No',
          onPress: () => {
            setFinalCallEnabled(true);
            setShowPrompt(false);
          },
          style: 'destructive',
        }
      ],
      { cancelable: false }
    );
  }
}, [showPrompt]);

return (
  <View style={styles.container}>
    <Text style={styles.header}>Donor Live Location</Text>
    {loading ? (
      <ActivityIndicator size="large" color="#ff6f61" style={{marginTop: 40}} />
    ) : error ? (
      <Text style={styles.error}>{error}</Text>
    ) : donors && donors.length > 0 ? (
      <ScrollView style={{width: '100%'}} contentContainerStyle={{alignItems: 'center'}}>
        {donors.map((donor) => {
          const donorLoc = donorLocations[donor.userId];
          const donorAddr = donorAddresses[donor.userId];
          const etaInfo = donorLoc && hospitalCoords ? calculateETA(donorLoc, hospitalCoords) : null;
          return (
            <View key={donor.userId} style={styles.infoPanel}>
              <View style={styles.row}>
                <Ionicons name="person" size={28} color="#ff6f61" style={{marginRight: 8}} />
                <Text style={styles.label}>{donor.name || 'Donor'}</Text>
              </View>
              <View style={styles.row}>
                <MaterialIcons name="location-on" size={24} color={donorLoc ? "#4caf50" : "#ff5722"} style={{marginRight: 6}} />
                <Text style={[styles.value, !donorLoc && styles.noLocationText]}>
                  {donorAddr
                    ? donorAddr
                    : donorLoc && donorLoc.latitude && donorLoc.longitude 
                      ? `Lat: ${donorLoc.latitude.toFixed(5)}, Lng: ${donorLoc.longitude.toFixed(5)}` 
                      : 'Location not available yet'}
                </Text>
              </View>
              {/* Location Status Message */}
              {!donorLoc && (
                <View style={styles.warningContainer}>
                  <MaterialIcons name="warning" size={20} color="#ff9800" style={{marginRight: 6}} />
                  <Text style={styles.warningText}>
                    Donor hasn't shared location yet. Please ask them to open the map screen.
                  </Text>
                </View>
              )}
              {/* Progress Bar for How Near Donor Is */}
              {etaInfo && etaInfo.distance !== undefined && (
                <View style={styles.progressBarContainer}>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFg, { width: `${Math.max(0, Math.min(100, 100 - (etaInfo.distance / 10) * 100))}%` }]} />
                  </View>
                  <Text style={styles.progressLabel}>
                    {etaInfo.distance <= 0.2 ? 'Arrived' : 
                     etaInfo.distance < 1 ? 'Very Close' : 
                     etaInfo.distance < 3 ? 'Nearby' : 
                     etaInfo.distance < 7 ? 'On the way' : 'Far'}
                  </Text>
                </View>
              )}
              {etaInfo && etaInfo.eta !== undefined && etaInfo.distance !== undefined && (
                <View style={styles.row}>
                  <Ionicons name="time" size={22} color="#ff9800" style={{marginRight: 6}} />
                  <Text style={styles.value}>ETA: {etaInfo.eta} min ({etaInfo.distance} km left)</Text>
                </View>
              )}
              {/* No ETA Available Message */}
              {!etaInfo && donorLoc && (
                <View style={styles.row}>
                  <Ionicons name="time" size={22} color="#ccc" style={{marginRight: 6}} />
                  <Text style={[styles.value, {color: '#999'}]}>ETA: Calculating...</Text>
                </View>
              )}
              {/* Timer Bar (show only for first donor for now) */}
              {timerActive && timer !== null && !donationCompleted && donors[0]?.userId === donor.userId && (
                <View style={styles.row}>
                  <Ionicons name="timer-outline" size={22} color="#2196f3" style={{marginRight: 6}} />
                  <Text style={styles.value}>Time left: {formatTime(timer)}</Text>
                </View>
              )}
              {/* Final Call Button (show only for first donor for now) */}
              {finalCallEnabled && requestId && donors[0]?.userId === donor.userId && (
                <TouchableOpacity
                  style={[styles.finalCallBtn, { marginTop: 10 }]}
                  onPress={async () => {
                    // Fetch donor phone
                    try {
                      const reqSnap = await getDoc(doc(db, 'requests', requestId));
                      const donorPhone = donor.phoneNumber;
                      if (donorPhone) Linking.openURL(`tel:${donorPhone}`);
                      else Alert.alert('Error', 'No donor phone found.');
                    } catch {
                      Alert.alert('Error', 'Could not fetch donor info.');
                    }
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Final Call Donor</Text>
                </TouchableOpacity>
              )}
              {/* Donation Complete Message */}
              {donationCompleted && (
                <Text style={[styles.value, { color: '#4caf50', marginTop: 12 }]}>Donation process completed. Thank you!</Text>
              )}
              <Text style={styles.updated}>Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : '-'}</Text>
            </View>
          );
        })}
      </ScrollView>
    ) : (
      <Text style={styles.value}>Waiting for donor location update...</Text>
    )}
    <TouchableOpacity style={styles.refreshBtn} onPress={() => setLoading(true)}>
      <Ionicons name="refresh" size={22} color="#fff" />
      <Text style={styles.refreshText}>Refresh</Text>
    </TouchableOpacity>
  </View>
);
}
const styles = StyleSheet.create({
  progressBarContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  progressBarBg: {
    width: '90%',
    height: 14,
    backgroundColor: '#eee',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressBarFg: {
    height: 14,
    backgroundColor: '#4caf50',
    borderRadius: 8,
  },
  progressLabel: {
    fontSize: 13,
    color: '#666',
    fontWeight: 'bold',
    marginTop: 2,
  },
  container: {
    flex: 1,
    backgroundColor: '#fff5f5',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 60,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ff6f61',
    marginBottom: 24,
  },
  infoPanel: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 24,
    marginTop: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    width: 320,
    alignItems: 'flex-start',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 18,
    color: '#222',
    fontWeight: '600',
  },
  value: {
    fontSize: 16,
    color: '#555',
  },
  updated: {
    marginTop: 10,
    fontSize: 13,
    color: '#888',
  },
  error: {
    color: '#ff5722',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 20,
  },
  noLocationText: {
    color: '#ff5722',
    fontStyle: 'italic',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3e0',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  warningText: {
    color: '#ff9800',
    fontSize: 14,
    flex: 1,
    lineHeight: 18,
  },
  noLocationText: {
    color: '#ff5722',
    fontStyle: 'italic',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3e0',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  warningText: {
    color: '#ff9800',
    fontSize: 14,
    flex: 1,
    lineHeight: 18,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff6f61',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 30,
    shadowColor: '#ff6f61',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 2,
  },
  refreshText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 8,
    fontWeight: 'bold',
  },
});


export default DonorTrackingScreen;
