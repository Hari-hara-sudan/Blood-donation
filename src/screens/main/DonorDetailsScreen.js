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
        
        console.log('=== DONOR DETAILS DEBUG ===');
        console.log('Route params:', route.params);
        console.log('Donors array:', donorsArray);
        console.log('Donors length:', donorsArray.length);
        
        // Fetch full donor details from users collection
        const donorPromises = donorsArray.map(async (donorItem, index) => {
          console.log(`Processing donor ${index + 1}:`, donorItem);
          console.log(`Type of donor item:`, typeof donorItem);
          
          let userId;
          let donorData = {};
          
          // Handle different data formats
          if (typeof donorItem === 'string') {
            // If it's just a user ID string
            userId = donorItem;
            console.log(`Donor is a string (userId): ${userId}`);
          } else if (typeof donorItem === 'object' && donorItem !== null) {
            // If it's an object, extract userId and keep existing data
            userId = donorItem.userId;
            donorData = { ...donorItem };
            console.log(`Donor is an object with userId: ${userId}`);
          } else {
            console.log(`Invalid donor format:`, donorItem);
            return null;
          }
          
          if (userId) {
            console.log(`Fetching user data for userId: ${userId}`);
            try {
              const userDoc = await getDoc(doc(db, 'users', userId));
              if (userDoc.exists()) {
                const userData = userDoc.data();
                console.log(`User data found:`, userData);
                const combined = {
                  ...donorData,
                  ...userData,
                  userId: userId
                };
                console.log(`Combined donor data:`, combined);
                return combined;
              } else {
                console.log(`No user document found for userId: ${userId}`);
              }
            } catch (fetchError) {
              console.error(`Error fetching user ${userId}:`, fetchError);
            }
          }
          
          return donorData.userId ? donorData : null; // Return original data if we have userId, null otherwise
        });

        const results = await Promise.all(donorPromises);
        const validDonorDetails = results.filter(donor => donor !== null);
        console.log('Final donor details:', validDonorDetails);
        setDonorDetails(validDonorDetails);

        // Fetch request details for hospital coordinates
        if (requestId) {
          console.log('Fetching request details for requestId:', requestId);
          const requestDoc = await getDoc(doc(db, 'requests', requestId));
          if (requestDoc.exists()) {
            const requestData = requestDoc.data();
            console.log('Request data:', requestData);
            if (requestData.location && requestData.location.latitude && requestData.location.longitude) {
              const coords = {
                latitude: requestData.location.latitude,
                longitude: requestData.location.longitude
              };
              console.log('Setting hospital coordinates:', coords);
              setHospitalCoords(coords);
            } else {
              console.log('Request location data is invalid:', requestData.location);
              setHospitalCoords(null);
            }
          } else {
            console.log('Request document not found for requestId:', requestId);
            setHospitalCoords(null);
          }
        } else {
          console.log('No requestId provided');
          setHospitalCoords(null);
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
    // Check if hospital coordinates are available
    if (!hospitalCoords || !hospitalCoords.latitude || !hospitalCoords.longitude) {
      Alert.alert(
        'Location Not Available', 
        'Hospital location coordinates are not available. Cannot show tracking map.',
        [{ text: 'OK' }]
      );
      return;
    }

    navigation.navigate('DonorTrackingScreen', {
      requestId,
      hospitalCoords,
      donors: donorDetails, // Pass all donor details
      selectedDonor: donor // Pass the specific donor if needed
    });
  };

  const donor = route?.params?.donor;
  const donorName = donor?.name || "Unknown";
  const donorBloodGroup = donor?.bloodGroup || "Unknown";

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
            {donorDetails.map((donor, idx) => {
              // Enhanced logic to extract donor information
              console.log(`=== RENDERING DONOR ${idx + 1} ===`);
              console.log('Raw donor data:', JSON.stringify(donor, null, 2));
              console.log('Available keys:', Object.keys(donor || {}));
              
              // Create a unique key for this donor
              const uniqueKey = donor?.userId || donor?.id || `donor-${idx}-${Date.now()}`;
              
              // Try multiple field combinations for name
              const displayName = donor?.name || 
                                donor?.displayName || 
                                donor?.fullName || 
                                donor?.username || 
                                donor?.email?.split('@')[0] ||
                                `Donor ${idx + 1}`;
              
              console.log('Display name result:', displayName);
              
              // Try multiple field combinations for blood group  
              const displayBloodGroup = donor?.bloodGroup || 
                                      donor?.blood_group || 
                                      donor?.bloodType || 
                                      donor?.blood_type ||
                                      'Unknown';
              
              console.log('Display blood group result:', displayBloodGroup);
              
              // Extract phone number with fallbacks
              const phoneNumber = donor?.phoneNumber || 
                                donor?.phone || 
                                donor?.mobile || 
                                donor?.contact ||
                                'No phone provided';
              
              console.log('Phone number result:', phoneNumber);
              
              // Extract profile photo
              const profilePhoto = donor?.photoURL || 
                                  donor?.profilePhoto || 
                                  donor?.avatar ||
                                  null;
              
              console.log('Profile photo result:', profilePhoto);
              return (
                <Card key={uniqueKey} style={styles.donorCard}>
                  <Card.Content>
                    <View style={styles.donorHeader}>
                      {profilePhoto ? (
                        <Avatar.Image 
                          size={56} 
                          source={{ uri: profilePhoto }}
                          style={styles.avatar}
                        />
                      ) : (
                        <Avatar.Text 
                          size={56} 
                          label={displayName.charAt(0).toUpperCase()}
                          style={styles.avatar}
                          labelStyle={styles.avatarLabel}
                        />
                      )}
                      <View style={styles.donorInfo}>
                        <Text style={styles.donorName}>{displayName}</Text>
                        <View style={styles.bloodGroupBadge}>
                          <Icon name="water" size={14} color="#ff6f61" />
                          <Text style={styles.bloodGroupText}>{displayBloodGroup}</Text>
                        </View>
                        {donor?.acceptedAt && (
                          <Text style={styles.acceptedTime}>
                            Accepted: {new Date(donor.acceptedAt.toDate ? donor.acceptedAt.toDate() : donor.acceptedAt).toLocaleString()}
                          </Text>
                        )}
                      </View>
                      <View style={styles.donorNumber}>
                        <Text style={styles.numberText}>#{idx + 1}</Text>
                      </View>
                    </View>

                    <View style={styles.contactInfo}>
                      <View style={styles.contactItem}>
                        <Icon name="phone" size={16} color="#666" />
                        <Text style={styles.contactText}>{phoneNumber}</Text>
                      </View>
                      {donor?.email && (
                        <View style={styles.contactItem}>
                          <Icon name="email" size={16} color="#666" />
                          <Text style={styles.contactText}>{donor.email}</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.actionButtons}>
                      <Button
                        mode="contained"
                        icon="phone"
                        onPress={() => phoneNumber !== 'No phone provided' && Linking.openURL(`tel:${phoneNumber}`)}
                        style={[styles.actionButton, styles.callButton]}
                        disabled={phoneNumber === 'No phone provided'}
                        compact
                      >
                        Call
                      </Button>
                      <Button
                        mode="outlined"
                        icon="map"
                        onPress={() => handleViewMap(donor)}
                        style={[styles.actionButton, styles.mapButton]}
                        disabled={!hospitalCoords || !hospitalCoords.latitude || !hospitalCoords.longitude}
                        compact
                      >
                        {(!hospitalCoords || !hospitalCoords.latitude || !hospitalCoords.longitude) ? 'Location N/A' : 'Track'}
                      </Button>
                    </View>
                  </Card.Content>
                </Card>
              );
            })}
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
  acceptedTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    fontStyle: 'italic',
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