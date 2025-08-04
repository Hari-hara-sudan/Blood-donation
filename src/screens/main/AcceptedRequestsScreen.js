import React, { useEffect, useState } from 'react';

// Calculate distance between two coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
import { View, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { Card, Title, Paragraph, Text, Button } from 'react-native-paper';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../services/firebase/config';

const AcceptedRequestsScreen = ({ navigation }) => {
  const [acceptedRequests, setAcceptedRequests] = useState([]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const requestsQuery = query(
      collection(db, 'requests'),
      where('status', '==', 'accepted'),
      where('donors', 'array-contains', auth.currentUser.uid)
    );
    const unsubscribe = onSnapshot(requestsQuery, (snapshot) => {
      const requests = [];
      snapshot.forEach((doc) => {
        requests.push({ id: doc.id, ...doc.data() });
      });
      setAcceptedRequests(requests);
    });
    return () => unsubscribe();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        <Title style={styles.sectionTitle}>Accepted Requests</Title>
        {acceptedRequests.length > 0 ? (
          acceptedRequests.map(request => (
            <Card key={request.id} style={styles.requestCard}>
              <Card.Content>
                <Title>{request.bloodGroup} Blood Needed</Title>
                <Paragraph>Hospital: {request.hospital}</Paragraph>
                <Paragraph>Units Needed: {request.units}</Paragraph>
                <Paragraph>Status: {request.status}</Paragraph>
{/* Distance calculation removed - not applicable in multi-donor model */}
                <Button
                  mode="contained"
                  icon="map"
                  style={styles.mapButton}
                  onPress={() => navigation.navigate('MapScreen', { requestId: request.id })}
                >
                  View Map
                </Button>
              </Card.Content>
            </Card>
          ))
        ) : (
          <Card style={styles.emptyCard}>
            <Card.Content>
              <Paragraph style={styles.emptyText}>No accepted requests found.</Paragraph>
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
  },
  container: {
    flex: 1,
    paddingHorizontal: 8,
    paddingBottom: 80,
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
    borderLeftColor: '#2196F3',
  },
  mapButton: {
    marginTop: 12,
    backgroundColor: '#2196F3',
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
});

export default AcceptedRequestsScreen;
