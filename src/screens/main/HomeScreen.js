import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert, SafeAreaView, Image, TouchableOpacity } from 'react-native';
import { Button, Card, Title, Text, Surface, Avatar, IconButton, Paragraph, Divider, Badge, Modal, Portal, Chip } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Location from 'expo-location';
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, orderBy, setDoc, enableMultiTabIndexedDbPersistence, serverTimestamp, addDoc, deleteDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth, COLLECTIONS } from '../../services/firebase/config';
import { initializeNotifications } from '../../services/NotificationService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, StatusBar, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { onAuthStateChanged } from 'firebase/auth';
import moment from 'moment';

const HomeScreen = ({ navigation }) => {
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({
    totalRequests: 0,
    activeRequests: 0,
    donations: 0
  });
  const [yourRequests, setYourRequests] = useState([]);
  const [availableRequests, setAvailableRequests] = useState([]);
  const [retryCount, setRetryCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedDonor, setSelectedDonor] = useState(null);
  const [profilePhotoURL, setProfilePhotoURL] = useState(null);
  const [timers, setTimers] = useState({});

  const urgencyLevels = [
    { label: 'Normal', value: 'normal', color: '#4CAF50', duration: 48 * 60 * 60 * 1000 }, // 2 days
    { label: 'Urgent', value: 'urgent', color: '#FF9800', duration: 6 * 60 * 60 * 1000 }, // 6 hours
    { label: 'Emergency', value: 'emergency', color: '#FF5722', duration: 1 * 60 * 60 * 1000 }, // 1 hour
    { label: 'Critical', value: 'critical', color: '#F44336', duration: 30 * 60 * 1000 }, // 30 minutes
  ];

  useEffect(() => {
    // Initialize stats document if it doesn't exist
    const initStats = async () => {
      const statsRef = doc(db, 'stats', 'global');
      const statsDoc = await getDoc(statsRef);
      
      if (!statsDoc.exists()) {
        await setDoc(statsRef, {
          totalRequests: 0,
          activeRequests: 0,
          donations: 0
        });
      }
    };

    initStats();
  }, []);

  useEffect(() => {
    // Create stats listener
    const statsQuery = query(collection(db, 'requests'));
    
    const unsubscribeStats = onSnapshot(statsQuery, (snapshot) => {
      try {
        const totalRequests = snapshot.size;
        const activeRequests = snapshot.docs.filter(
          doc => doc.data().status === 'active'
        ).length;
        const completedDonations = snapshot.docs.filter(
          doc => doc.data().status === 'completed'
        ).length;

        setStats({
          totalRequests,
          activeRequests,
          donations: completedDonations
        });

        console.log('Stats updated:', {
          total: totalRequests,
          active: activeRequests,
          completed: completedDonations
        });

      } catch (error) {
        console.error('Error updating stats:', error);
      }
    });

    return () => unsubscribeStats();
  }, []);

  useEffect(() => {
    if (!auth.currentUser) return;

    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', auth.currentUser.uid),
      where('read', '==', false),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeNotifications = onSnapshot(notificationsQuery, (snapshot) => {
      const notificationsList = [];
      snapshot.forEach((doc) => {
        notificationsList.push({
          id: doc.id,
          ...doc.data()
        });
      });
      setNotifications(notificationsList);
      setUnreadCount(notificationsList.length);
    });

    return () => unsubscribeNotifications();
  }, []);

  const checkLocationPermissions = async () => {
    try {
      // First check if location is enabled
      const serviceEnabled = await Location.hasServicesEnabledAsync();
      console.log('Location service enabled:', serviceEnabled);

      if (!serviceEnabled) {
        Alert.alert(
          'Location Services Disabled',
          'Please enable Location in device settings',
          [
            {
              text: 'Open Settings',
              onPress: () => {
                Linking.openSettings();
                setRetryCount(prev => prev + 1);
              }
            },
            {
              text: 'Retry',
              onPress: () => setRetryCount(prev => prev + 1)
            }
          ]
        );
        return false;
      }

      // Check foreground permission
      const { status: foregroundStatus } = await Location.getForegroundPermissionsAsync();
      console.log('Foreground permission status:', foregroundStatus);

      if (foregroundStatus !== 'granted') {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permission Denied',
            'Location permission is required. Please enable it in Settings.',
            [
              {
                text: 'Open Settings',
                onPress: () => {
                  Linking.openSettings();
                  setRetryCount(prev => prev + 1);
                }
              },
              {
                text: 'Retry',
                onPress: () => setRetryCount(prev + 1)
              }
            ]
          );
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Permission check error:', error);
      return false;
    }
  };

  useEffect(() => {
    let locationSubscription = null;

    const getLocation = async () => {
      try {
        const hasPermission = await checkLocationPermissions();
        if (!hasPermission) {
          setLocationError('Location permission required');
          return;
        }

        // Try getting last known location first
        const lastLocation = await Location.getLastKnownPositionAsync();
        if (lastLocation) {
          console.log('Using last known location:', lastLocation);
          setLocation(lastLocation);
        }

        // Then try getting current location with timeout
        const locationPromise = Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced, // Try Balanced first
          timeInterval: 5000,
          distanceInterval: 0
        });

        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Location request timeout')), 15000);
        });

        const currentLocation = await Promise.race([locationPromise, timeoutPromise]);
        console.log('New location obtained:', currentLocation);
        setLocation(currentLocation);
        setLocationError(null);

      } catch (error) {
        console.error('Location error:', error);
        // If high accuracy fails, try with low accuracy
        try {
          const lowAccuracyLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Low,
            timeInterval: 5000
          });
          console.log('Low accuracy location obtained:', lowAccuracyLocation);
          setLocation(lowAccuracyLocation);
          setLocationError(null);
        } catch (lowAccError) {
          console.error('Low accuracy location error:', lowAccError);
          setLocationError('Unable to get location. Please check device settings.');
          Alert.alert(
            'Location Error',
            'Failed to get location. Please try again.',
            [
              {
                text: 'Retry',
                onPress: () => setRetryCount(prev => prev + 1)
              }
            ]
          );
        }
      }
    };

    getLocation();
    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [retryCount]);

  // Update requests query to handle location changes
  useEffect(() => {
    if (!location) return;

    const requestsQuery = query(
      collection(db, 'requests'),
      where('status', 'in', ['active', 'accepted'])
    );

    const unsubscribeRequests = onSnapshot(requestsQuery, 
      (snapshot) => {
        try {
          const yourRequestsList = [];
          const availableRequestsList = [];
          
          snapshot.forEach((doc) => {
            const data = doc.data();
            const requestItem = { 
              id: doc.id,
              ...data 
            };

            // Calculate distance if location exists
            if (data.location) {
              const distance = calculateDistance(
                location.coords.latitude,
                location.coords.longitude,
                data.location.latitude,
                data.location.longitude
              );
              requestItem.distance = distance;
            }

            // Always show user's own requests regardless of status
            if (data.userId === auth.currentUser?.uid) {
              yourRequestsList.push(requestItem);
            } 
            // Show only active requests to potential donors
            else if (data.status === 'active' && !data.donorDetails) {
              if (!requestItem.distance || requestItem.distance <= 15) {
                availableRequestsList.push(requestItem);
              }
            }
          });

          console.log('Requests found:', {
            yours: yourRequestsList.length,
            available: availableRequestsList.length
          });

          setYourRequests(yourRequestsList);
          setAvailableRequests(availableRequestsList);

        } catch (error) {
          console.error('Error processing requests:', error);
        }
      }
    );

    return () => unsubscribeRequests();
  }, [location]);

  // Add auth state listener
  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(user => {
      if (!user) {
        navigation.replace('Login');
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      await AsyncStorage.removeItem('user');
      navigation.reset({
        index: 0,
        routes: [{ name: 'Landing' }]
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Update handleAcceptRequest function
  const handleAcceptRequest = async (requestId) => {
    try {
      // Get current user (donor) details
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const userData = userDoc.data();
      
      // Get request details
      const requestRef = doc(db, 'requests', requestId);
      const requestDoc = await getDoc(requestRef);
      const requestData = requestDoc.data();
  
      // Update request with donor details
      await updateDoc(requestRef, {
        status: 'accepted',
        donorId: auth.currentUser.uid,
        donorDetails: {
          name: userData.name,
          phoneNumber: userData.phoneNumber,
          bloodGroup: userData.bloodGroup,
          photoURL: userData.photoURL || null,
          acceptedAt: serverTimestamp()
        }
      });
  
      // Show confirmation to donor
      Alert.alert(
        'Success',
        'You have accepted the request. The requester will be notified.',
        [{ text: 'OK' }]
      );
  
    } catch (error) {
      console.error('Error accepting request:', error);
      Alert.alert('Error', 'Failed to accept request');
    }
  };

  // Add this function near your other handlers
  const handleContactRequester = async (request) => {
    try {
      // Get requester details
      const requesterDoc = await getDoc(doc(db, 'users', request.userId));
      const requesterData = requesterDoc.data();
      
      Alert.alert(
        'Contact Requester',
        `${requesterData.name} - ${request.bloodGroup}`,
        [
          {
            text: 'Call',
            onPress: () => Linking.openURL(`tel:${requesterData.phoneNumber}`)
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );
    } catch (error) {
      console.error('Error getting requester details:', error);
      Alert.alert('Error', 'Could not fetch requester contact details');
    }
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const getTimeLeft = (createdAt, duration) => {
    if (!createdAt) return '';
    const endTime = moment(createdAt).add(duration, 'milliseconds');
    const remaining = moment.duration(endTime.diff(moment()));
    
    if (remaining.asMilliseconds() <= 0) {
      return 'Expired';
    }

    const hours = Math.floor(remaining.asHours());
    const minutes = remaining.minutes();
    const seconds = remaining.seconds();

    return `${hours > 0 ? `${hours}h ` : ''}${minutes}m ${seconds}s`;
  };

  useEffect(() => {
    // ...existing useEffects...

    // Set up timers for all available requests
    const timerInterval = setInterval(() => {
      const newTimers = {};
      availableRequests.forEach(request => {
        const urgencyLevel = urgencyLevels.find(level => level.value === request.urgency);
        const createdAt = request.createdAt?.toDate();
        newTimers[request.id] = getTimeLeft(createdAt, urgencyLevel?.duration);
      });
      setTimers(newTimers);
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [availableRequests]);

  // Show loading or error state
  if (locationError) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>
          {locationError}
        </Text>
        <Button
          mode="contained"
          onPress={() => setRetryCount(prev => prev + 1)}
          style={styles.retryButton}
        >
          Retry Location Access
        </Button>
      </View>
    );
  }

  // Add this component inside HomeScreen
  const DonorDetailsModal = () => (
    <Portal>
      <Modal 
        visible={selectedDonor !== null}
        onDismiss={() => setSelectedDonor(null)}
        contentContainerStyle={styles.modalContainer}
      >
        {selectedDonor && (
          <Card style={styles.modalCard}>
            <ScrollView>
              <Card.Content style={styles.modalContent}>
                <View style={styles.acceptedBanner}>
                  <Icon name="check-circle" size={20} color="#4CAF50" />
                  <Text style={styles.acceptedText}>Request Accepted</Text>
                </View>

                <Title style={styles.donorTitle}>Donor Information</Title>
                <View style={styles.donorInfo}>
                  <Avatar.Icon size={80} icon="account" style={styles.donorAvatar} />
                  <View style={styles.donorDetails}>
                    <Text style={styles.donorName}>{selectedDonor.name}</Text>
                    <Text style={styles.donorBlood}>
                      Blood Group: {selectedDonor.bloodGroup}
                    </Text>
                  </View>
                </View>

                <Button
                  mode="contained"
                  icon="phone"
                  onPress={() => Linking.openURL(`tel:${selectedDonor.phoneNumber}`)}
                  style={styles.callButton}
                >
                  Call Donor
                </Button>

                <Button
                  mode="outlined"
                  onPress={() => setSelectedDonor(null)}
                  style={styles.closeButton}
                >
                  Close
                </Button>
              </Card.Content>
            </ScrollView>
          </Card>
        )}
      </Modal>
    </Portal>
  );

  // Modify your renderYourRequest function
  const renderYourRequest = (request) => (
    <Card key={request.id} style={[styles.requestCard, styles.yourRequestCard]}>
      <Card.Content>
        <Title>{request.bloodGroup} Blood Needed</Title>
        <Paragraph>Hospital: {request.hospital}</Paragraph>
        <Paragraph>Units Needed: {request.units}</Paragraph>
        
        {request.donorDetails ? (
          <Button
            mode="contained"
            onPress={() => setSelectedDonor(request.donorDetails)}
            style={styles.viewDetailsButton}
          >
            View Donor Details
          </Button>
        ) : (
          <Button
            mode="contained"
            disabled
            style={styles.waitingButton}
          >
            Waiting for Donor
          </Button>
        )}

        <Button
          mode="outlined"
          onPress={async () => {
            try {
              const requestRef = doc(db, 'requests', request.id);
              await deleteDoc(requestRef);
              Alert.alert('Success', 'Request cancelled successfully');
            } catch (error) {
              console.error('Error deleting request:', error);
              Alert.alert('Error', 'Failed to cancel request');
            }
          }}
          style={styles.deleteButton}
          textColor="#FF5252"
        >
          Cancel Request
        </Button>
      </Card.Content>
    </Card>
  );

  const renderRequest = (request) => {
    const urgencyLevel = urgencyLevels.find(level => level.value === request.urgency);
  
    return (
      <Card key={request.id} style={[styles.requestCard, { borderLeftColor: urgencyLevel.color }]}>
        <Card.Content>
          <Title>{request.bloodGroup} Blood Needed</Title>
          <Paragraph>Hospital: {request.hospital}</Paragraph>
          <Paragraph>Units Needed: {request.units}</Paragraph>
          <Chip style={[styles.urgencyChip, { backgroundColor: urgencyLevel.color }]}>
            {urgencyLevel.label}
          </Chip>
          {/* ...other request details... */}
        </Card.Content>
      </Card>
    );
  };

  // useEffect(() => {
  //   const fetchProfilePhoto = async () => {
  //     if (!auth.currentUser) {
  //       console.error('User is not authenticated');
  //       return;
  //     }
  
  //     try {
  //       const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, auth.currentUser.uid));
  //       if (userDoc.exists()) {
  //         const userData = userDoc.data();
  //         setProfilePhotoURL(userData.photoURL);
  //       }
  //     } catch (error) {
  //       console.error('Error fetching profile photo:', error);
  //     }
  //   };
  
  //   fetchProfilePhoto();
  // }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Add a delay before fetching the profile photo
        setTimeout(() => {
          fetchProfilePhoto(user.uid);
        }, 5000); // 5 seconds delay
      } else {
        console.error('User is not authenticated');
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const fetchProfilePhoto = async (uid) => {
    try {
      const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setProfilePhotoURL(userData.photoURL);
      }
    } catch (error) {
      console.error('Error fetching profile photo:', error);
    }
  };

  const renderAvailableRequests = () => (
    availableRequests.map(request => {
      const urgencyLevel = urgencyLevels.find(level => level.value === request.urgency);
      const isExpired = timers[request.id] === 'Expired';

      return (
        <Card key={request.id} style={[styles.requestCard]}>
          <Card.Content>
            <View style={styles.requestHeaderRow}>
              <Title style={styles.bloodTitle}>{request.bloodGroup} Blood Needed</Title>
              <View style={[styles.urgencyBadge, { backgroundColor: `${urgencyLevel?.color}15` }]}>
                <View style={[styles.urgencyDot, { backgroundColor: urgencyLevel?.color }]} />
                <Text style={[styles.urgencyText, { color: urgencyLevel?.color }]}>
                  {urgencyLevel?.label}
                </Text>
              </View>
            </View>
            
            <Paragraph>Hospital: {request.hospital}</Paragraph>
            <Paragraph>Units Needed: {request.units}</Paragraph>
            <Paragraph>Distance: {request.distance?.toFixed(2)} km</Paragraph>
            
            <View style={styles.timerContainer}>
              <Icon name="clock-outline" size={16} color={isExpired ? '#F44336' : urgencyLevel?.color} />
              <Text style={[
                styles.timerText, 
                { color: isExpired ? '#F44336' : urgencyLevel?.color }
              ]}>
                {timers[request.id]}
              </Text>
            </View>

            <Button 
              mode="contained" 
              style={[styles.actionButton, isExpired && styles.disabledButton]}
              onPress={() => navigation.navigate('ConfirmRequest', { request })}
              disabled={isExpired}
            >
              {isExpired ? 'Request Expired' : 'Accept Request'}
            </Button>
          </Card.Content>
        </Card>
      );
    })
  );

  useEffect(() => {
    // Add a realtime listener for available requests
    const requestsQuery = query(
      collection(db, 'requests'),
      where('status', '==', 'active')
    );

    const unsubscribe = onSnapshot(requestsQuery, async (snapshot) => {
      try {
        const requests = [];
        for (const doc of snapshot.docs) {
          const request = { ...doc.data(), id: doc.id };
          
          // Skip if createdAt is missing
          if (!request.createdAt) continue;

          // Convert Firestore Timestamp to Date
          const createdAt = request.createdAt.toDate();
          const urgencyLevel = urgencyLevels.find(level => level.value === request.urgency);
          
          if (!urgencyLevel) continue;

          // Check if request is still within its time window
          const endTime = moment(createdAt).add(urgencyLevel.duration, 'milliseconds');
          if (moment().isBefore(endTime)) {
            // Only add requests that haven't expired
            if (auth.currentUser?.uid !== request.userId) {
              // Calculate distance if location is available
              if (location && request.location) {
                const distance = calculateDistance(
                  location.coords.latitude,
                  location.coords.longitude,
                  request.location.latitude,
                  request.location.longitude
                );
                request.distance = distance;
              }
              requests.push(request);
            }
          }
        }

        // Sort requests by urgency and creation time
        requests.sort((a, b) => {
          const urgencyA = urgencyLevels.findIndex(level => level.value === a.urgency);
          const urgencyB = urgencyLevels.findIndex(level => level.value === b.urgency);
          if (urgencyA !== urgencyB) return urgencyB - urgencyA;
          return b.createdAt.toDate() - a.createdAt.toDate();
        });

        setAvailableRequests(requests);
      } catch (error) {
        console.error('Error processing requests:', error);
      }
    });

    return () => unsubscribe();
  }, [location]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.mainContainer}>
        <Surface style={styles.header}>
          <View style={styles.headerLeft}>
            <Icon name="blood-bag" size={24} color="#ff6f61" />
            <Title style={styles.headerTitle}>Blood Bank</Title>
          </View>
          <TouchableOpacity style={styles.profileIconContainer} onPress={() => navigation.navigate('Profile')}>
            {profilePhotoURL ? (
              <Image source={{ uri: profilePhotoURL }} style={styles.profileImage} />
            ) : (
              <Avatar.Icon size={40} icon="account" style={styles.avatar} />
            )}
          </TouchableOpacity>
        </Surface>

        <ScrollView style={styles.container}>
          <View style={styles.statsContainer}>
            <Card style={styles.statsCard}>
              <Card.Content style={styles.cardContent}>
                <Avatar.Icon size={40} icon="water" style={styles.icon} />
                <View>
                  <Title style={styles.statNumber}>{stats.totalRequests}</Title>
                  <Paragraph style={styles.statLabel}>Total Requests</Paragraph>
                </View>
              </Card.Content>
            </Card>

            <Card style={styles.statsCard}>
              <Card.Content style={styles.cardContent}>
                <Avatar.Icon size={40} icon="heart-pulse" style={styles.icon} />
                <View>
                  <Title style={styles.statNumber}>{stats.donations}</Title>
                  <Paragraph style={styles.statLabel}>Lives Saved</Paragraph>
                </View>
              </Card.Content>
            </Card>
          </View>
          {yourRequests.length > 0 && (
            <>
              <Title style={styles.sectionTitle}>Your Active Requests</Title>
              {yourRequests.map(request => renderYourRequest(request))}
            </>
          )}

          <Title style={styles.sectionTitle}>Available Blood Requests</Title>
          {availableRequests.length > 0 ? renderAvailableRequests() : (
            <Card style={styles.emptyCard}>
              <Card.Content>
                <Paragraph style={styles.emptyText}>No available requests in your area</Paragraph>
              </Card.Content>
            </Card>
          )}
        </ScrollView>

        <Button
          mode="contained"
          icon="plus"
          style={styles.fab}
          labelStyle={styles.fabLabel}
          onPress={() => navigation.navigate('CreateRequest')}
        >
          Create Request
        </Button>
      </View>
      <DonorDetailsModal />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff5f5',
    paddingTop: Platform.OS === 'android' ? 0 : 0,  // Remove extra padding
  },
  mainContainer: {
    flex: 1,
    backgroundColor: '#fff5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 8 : 16, // Add StatusBar height
    backgroundColor: 'white',
    elevation: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    zIndex: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    marginLeft: 12,
    color: '#ff6f61',
    fontSize: 22,
    fontWeight: 'bold',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileIconContainer: {
    padding: 2,
    borderRadius: 20,
    backgroundColor: 'white',
  },
  profileButton: {
    margin: 0,
  },
  container: {
    flex: 1,
    paddingHorizontal: 8,
    paddingBottom: 80, // Add padding to avoid FAB overlap
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    marginTop: 8,
  },
  statsCard: {
    width: '48%',
    backgroundColor: 'white',
    elevation: 3,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  icon: {
    backgroundColor: '#ff6f61',
    marginRight: 12,
  },
  statNumber: {
    color: '#ff6f61',
    marginBottom: 4,
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#666',
    fontSize: 14,
  },
  sectionTitle: {
    padding: 16,
    color: '#ff6f61',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 8,
  },
  requestCard: {
    margin: 8,
    backgroundColor: 'white',
    elevation: 3,
    borderRadius: 12,
    overflow: 'hidden',
    borderLeftWidth: 4,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#ff6f61',
    marginHorizontal: 8,
    marginBottom: 8,
    borderRadius: 8,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    backgroundColor: '#ff6f61',
    borderRadius: 30,
    elevation: 5,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  fabLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  yourRequestCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#ff6f61',
  },
  emptyCard: {
    margin: 8,
    backgroundColor: 'white',
    elevation: 2,
    borderRadius: 12,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
  },
  donorSection: {
    marginTop: 16,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 16,
  },
  divider: {
    backgroundColor: '#ff6f61',
    marginVertical: 8,
  },
  donorTitle: {
    fontSize: 18,
    color: '#ff6f61',
    marginBottom: 12,
  },
  donorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  donorAvatar: {
    backgroundColor: '#ff6f61',
  },
  donorDetails: {
    marginLeft: 16,
    flex: 1,
  },
  donorName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  callButton: {
    marginTop: 12,
    backgroundColor: '#4CAF50',
  },
  acceptedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  acceptedText: {
    color: '#4CAF50',
    marginLeft: 8,
    fontWeight: 'bold',
  },
  acceptedTime: {
    color: '#666',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'right',
  },
  contactButton: {
    marginHorizontal: 8,
    marginBottom: 8,
    borderColor: '#ff6f61',
    borderWidth: 1,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginTop: 20,
  },
  errorText: {
    color: '#ff6f61',
    textAlign: 'center',
    padding: 16,
    fontSize: 16
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#ff6f61',
  },
  acceptButton: {
    marginTop: 12,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  viewDetailsButton: {
    backgroundColor: '#4CAF50',
    flex: 1,
    marginRight: 8,
  },
  waitingButton: {
    backgroundColor: '#FFEB3B',
    flex: 1,
    marginRight: 8,
  },
  deleteButton: {
    borderColor: '#FF5252',
    borderWidth: 1,
    flex: 1,
  },
  buttonContainer: {
    marginTop: 12,
    gap: 8,
  },
  viewDetailsButton: {
    backgroundColor: 'rgb(33, 193, 38)',
    borderRadius: 8,
  },
  waitingButton: {
    backgroundColor: '#FFA000',
    borderRadius: 8,
  },
  deleteButton: {
    borderColor: '#FF5252',
    borderRadius: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
    margin: 0, // Remove margin to make it full screen
    padding: 0, // Remove padding to make it full screen
  },
  modalCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 0, // Remove border radius for full screen
    elevation: 0, // Remove elevation for full screen
  },
  modalContent: {
    padding: 20, // Add padding to the content instead
  },
  modalContainer: {
    padding: 20,
    margin: 20,
  },
  modalCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    elevation: 5,
  },
  acceptedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  acceptedText: {
    color: '#4CAF50',
    marginLeft: 8,
    fontWeight: 'bold',
    fontSize: 16,
  },
  donorTitle: {
    fontSize: 22,
    color: '#ff6f61',
    marginBottom: 16,
  },
  donorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  donorAvatar: {
    backgroundColor: '#ff6f61',
  },
  donorDetails: {
    marginLeft: 16,
    flex: 1,
  },
  donorName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  donorBlood: {
    fontSize: 16,
    color: '#666',
  },
  callButton: {
    marginTop: 16,
    backgroundColor: '#4CAF50',
  },
  closeButton: {
    marginTop: 12,
    borderColor: '#666',
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatar: {
    backgroundColor: '#ff6f61',
  },
  urgencyChip: {
    marginTop: 8,
    alignSelf: 'flex-start',
    color: 'white',
  },
  requestHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  bloodTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ff6f61',
  },
  urgencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  urgencyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  urgencyText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  timerText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#E0E0E0',
  },
});

export default HomeScreen;
