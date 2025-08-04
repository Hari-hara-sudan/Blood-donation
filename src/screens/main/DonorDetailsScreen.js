import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Linking, Alert, ActivityIndicator } from 'react-native';
import { Card, Title, Text, Button, Avatar, Paragraph } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { doc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase/config';

const DonorDetailsScreen = ({ route, navigation }) => {
  const { donors = [], requestId, request } = route.params;
  const [donorDetails, setDonorDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hospitalCoords, setHospitalCoords] = useState(null);

  // Support backward compatibility for single donor
  const donorsArray = Array.isArray(donors) ? donors : donors ? [donors] : [];

  useEffect(() => {
    const fetchDonorDetails = async () => {
      try {
        setLoading(true);
        
        // Fetch full donor details from users collection
        const donorPromises = donorsArray.map(async (donor) => {
          if (donor.userId) {
            const userDoc = await getDoc(doc(db, 'users', donor.userId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              return {
                ...donor,
                ...userData,
                userId: donor.userId
              };
            }
          }
          return donor; // fallback to original donor data
        });

        const fullDonorDetails = await Promise.all(donorPromises);
        setDonorDetails(fullDonorDetails);

        // Fetch request details for hospital coordinates
        if (requestId) {
          const requestDoc = await getDoc(doc(db, 'requests', requestId));
          if (requestDoc.exists()) {
            const requestData = requestDoc.data();
            if (requestData.location) {
              setHospitalCoords({
                latitude: requestData.location.latitude,
                longitude: requestData.location.longitude
              });
            }
          }
        }
      } catch (error) {
        console.error('Error fetching donor details:', error);
        Alert.alert('Error', 'Failed to load donor details');
      } finally {
        setLoading(false);
      }
    };

    if (donorsArray.length > 0) {
      fetchDonorDetails();
    } else {
      setLoading(false);
    }
  }, [donorsArray, requestId]);

  const handleViewMap = (donor) => {
    navigation.navigate('DonorTrackingScreen', {
      requestId,
      hospitalCoords,
      donors: donorDetails, // Pass all donor details
      selectedDonor: donor // Pass the specific donor if needed
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Icon name="heart" size={24} color="#ff6f61" />
          <Text style={styles.headerTitle}>Donor Details</Text>
        </View>
        <View style={styles.statusBadge}>
          <Icon name="check-circle" size={16} color="#4CAF50" />
          <Text style={styles.statusText}>Accepted</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ff6f61" />
            <Text style={styles.loadingText}>Loading donor details...</Text>
          </View>
        ) : donorDetails.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <Icon name="account-search" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No donors have accepted yet</Text>
              <Text style={styles.emptySubtext}>Please wait for donors to respond</Text>
            </Card.Content>
          </Card>
        ) : (
          <>
            <Text style={styles.sectionTitle}>
              {donorDetails.length} Donor{donorDetails.length > 1 ? 's' : ''} Accepted
            </Text>
            {donorDetails.map((donor, idx) => (
              <Card key={idx} style={styles.donorCard}>
                <Card.Content>
                  <View style={styles.donorHeader}>
                    <Avatar.Text 
                      size={56} 
                      label={donor?.name ? donor.name.charAt(0).toUpperCase() : 'D'}
                      style={styles.avatar}
                      labelStyle={styles.avatarLabel}
                    />
                    <View style={styles.donorInfo}>
                      <Text style={styles.donorName}>{donor?.name || `Donor ${idx + 1}`}</Text>
                      <View style={styles.bloodGroupBadge}>
                        <Icon name="water" size={14} color="#ff6f61" />
                        <Text style={styles.bloodGroupText}>{donor?.bloodGroup || 'Unknown'}</Text>
                      </View>
                    </View>
                    <View style={styles.donorNumber}>
                      <Text style={styles.numberText}>#{idx + 1}</Text>
                    </View>
                  </View>

                  <View style={styles.contactInfo}>
                    <View style={styles.contactItem}>
                      <Icon name="phone" size={16} color="#666" />
                      <Text style={styles.contactText}>{donor?.phoneNumber || 'No phone provided'}</Text>
                    </View>
                  </View>

                  <View style={styles.actionButtons}>
                    <Button
                      mode="contained"
                      icon="phone"
                      onPress={() => donor?.phoneNumber && Linking.openURL(`tel:${donor.phoneNumber}`)}
                      style={[styles.actionButton, styles.callButton]}
                      disabled={!donor?.phoneNumber}
                      compact
                    >
                      Call
                    </Button>
                    <Button
                      mode="outlined"
                      icon="map"
                      onPress={() => handleViewMap(donor)}
                      style={[styles.actionButton, styles.mapButton]}
                      disabled={!hospitalCoords}
                      compact
                    >
                      Track
                    </Button>
                  </View>
                </Card.Content>
              </Card>
            ))}
          </>
        )}
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <Button
          mode="outlined"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          icon="arrow-left"
        >
          Back
        </Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff5f5',
  },
  header: {
    backgroundColor: '#fff',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  statusText: {
    color: '#4CAF50',
    fontWeight: '600',
    marginLeft: 4,
    fontSize: 12,
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  donorCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  donorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    backgroundColor: '#ff6f61',
  },
  avatarLabel: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  donorInfo: {
    flex: 1,
    marginLeft: 16,
  },
  donorName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  bloodGroupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff0ef',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  bloodGroupText: {
    color: '#ff6f61',
    fontWeight: '600',
    marginLeft: 4,
    fontSize: 12,
  },
  donorNumber: {
    backgroundColor: '#f0f0f0',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  numberText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
  },
  contactInfo: {
    marginBottom: 16,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  contactText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 8,
  },
  callButton: {
    backgroundColor: '#4CAF50',
  },
  mapButton: {
    borderColor: '#2196F3',
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    elevation: 2,
    marginTop: 40,
  },
  emptyContent: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  bottomActions: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    borderColor: '#ff6f61',
    borderRadius: 12,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
});

export default DonorDetailsScreen;