import { View, ScrollView, StyleSheet, SafeAreaView, Platform, StatusBar } from 'react-native';
import React, { useState, useEffect } from 'react'; // Add this line
import { Card, Title, Paragraph, Text, Button } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import moment from 'moment';
import * as Location from 'expo-location';
import { collection, query, where, onSnapshot, getDocs, writeBatch } from 'firebase/firestore';
import { db, auth } from '../../services/firebase/config';
import { deleteDoc, doc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

const urgencyLevels = [
  { label: 'Routine', value: 'routine', color: '#4CAF50', duration: 48 * 60 * 60 * 1000 },
  { label: 'Priority', value: 'priority', color: '#FF9800', duration: 6 * 60 * 60 * 1000 },
  { label: 'Emergency', value: 'emergency', color: '#FF5722', duration: 1 * 60 * 60 * 1000 },
  { label: 'Critical', value: 'critical', color: '#F44336', duration: 30 * 60 * 1000 },
];

const AvailableRequestsScreen = ({ navigation }) => {
  const [availableRequests, setAvailableRequests] = useState([]);
  const [timers, setTimers] = useState({});
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);

  useEffect(() => {
    const getLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationError('Permission to access location was denied');
          return;
        }

        const loc = await Location.getCurrentPositionAsync({});
        setLocation(loc);
      } catch (error) {
        setLocationError('Error getting location');
      }
    };

    getLocation();
  }, []);

  useEffect(() => {
    if (!location) return;

    const requestsQuery = query(
      collection(db, 'requests'),
      where('status', 'in', ['active', 'accepted'])
    );

    const unsubscribeRequests = onSnapshot(requestsQuery, 
      (snapshot) => {
        try {
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

            // Only show active requests from OTHER users to potential donors
            if (data.status === 'active' && 
                !data.donorDetails && 
                data.userId !== auth.currentUser?.uid) { // Add this condition
              if (!requestItem.distance || requestItem.distance <= 15) {
                availableRequestsList.push(requestItem);
              }
            }
          });

          setAvailableRequests(availableRequestsList);

        } catch (error) {
          console.error('Error processing requests:', error);
        }
      }
    );

    return () => unsubscribeRequests();
  }, [location]);

  useEffect(() => {
    const timerInterval = setInterval(() => {
      const newTimers = {};
      availableRequests.forEach(request => {
        const urgencyLevel = urgencyLevels.find(level => level.value === request.urgency);
        const createdAt = request.createdAt?.toDate();
        const endTime = moment(createdAt).add(urgencyLevel?.duration || 0, 'milliseconds');
        const remaining = moment.duration(endTime.diff(moment()));
        newTimers[request.id] = remaining.asMilliseconds() > 0 ? 
          `${remaining.hours()}h ${remaining.minutes()}m ${remaining.seconds()}s` : 'Expired';
      });
      setTimers(newTimers);
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [availableRequests]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is signed in
        deleteExpiredRequests();
      } else {
        // User is signed out
        console.log('User is not authenticated');
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const deleteExpiredRequests = async () => {
    try {
      const requestsQuery = query(
        collection(db, 'requests'),
        where('status', '==', 'active')
      );

      const snapshot = await getDocs(requestsQuery);
      const batch = writeBatch(db);

      snapshot.forEach((doc) => {
        const data = doc.data();
        const createdAt = data.createdAt.toDate();
        const urgencyLevel = urgencyLevels.find(level => level.value === data.urgency);
        const endTime = moment(createdAt).add(urgencyLevel?.duration || 0, 'milliseconds');

        if (moment().isAfter(endTime)) {
          batch.delete(doc.ref);
        }
      });

      await batch.commit();
      console.log('Expired requests deleted successfully');
    } catch (error) {
      console.error('Error deleting expired requests:', error);
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
            <Paragraph>Distance: {request.distance ? request.distance.toFixed(2) : 'N/A'} km</Paragraph>
            
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        <Title style={styles.sectionTitle}>Available Blood Requests</Title>
        {availableRequests.length > 0 ? (
          renderAvailableRequests()
        ) : (
          <Card style={styles.emptyCard}>
            <Card.Content>
              <Paragraph style={styles.emptyText}>No available requests in your area</Paragraph>
            </Card.Content>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff5f5',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0
  },
  container: {
    flex: 1,
    paddingHorizontal: 8,
    paddingBottom: 80
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
  requestHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bloodTitle: {
    flex: 1,
    fontSize: 20,
    marginRight: 8,
  },
  urgencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 16,
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
    marginVertical: 12,
    backgroundColor: '#f8f8f8',
    padding: 8,
    borderRadius: 8,
  },
  timerText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: 'bold',
  },
  actionButton: {
    marginTop: 8,
    backgroundColor: '#ff6f61',
    borderRadius: 8,
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
  }
});

export default AvailableRequestsScreen;