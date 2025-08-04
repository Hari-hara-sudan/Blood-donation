// Blood group compatibility map
const bloodGroupCompatibility = {
  'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'], // Universal donor
  'O+': ['O+', 'A+', 'B+', 'AB+'],
  'A-': ['A-', 'A+', 'AB-', 'AB+'],
  'A+': ['A+', 'AB+'],
  'B-': ['B-', 'B+', 'AB-', 'AB+'],
  'B+': ['B+', 'AB+'],
  'AB-': ['AB-', 'AB+'],
  'AB+': ['AB+'], // Universal recipient
};

// Returns true if donorBloodGroup can donate to recipientBloodGroup
export function isBloodGroupCompatible(donorBloodGroup, recipientBloodGroup) {
  return bloodGroupCompatibility[donorBloodGroup]?.includes(recipientBloodGroup);
}
import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, SafeAreaView, Alert, TouchableOpacity, Platform, StatusBar } from 'react-native';
import { TextInput, Button, Title, SegmentedButtons, Card, Snackbar, Dialog, Portal, Text } from 'react-native-paper';
import Autocomplete from 'react-native-autocomplete-input';
import { collection, addDoc, serverTimestamp, deleteDoc, doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, auth, COLLECTIONS } from '../services/firebase/config';
import * as Location from 'expo-location';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const validHospitals = [
  { name: 'Sri Venkateswara Hospital', address: 'Near Bus Stand, Srivilliputhur, Tamil Nadu 626125' },
  { name: 'Government Hospital Srivilliputhur', address: 'Hospital Road, Srivilliputhur, Tamil Nadu 626125' },
  { name: 'Krishnankoil Medical Center', address: 'Main Road, Krishnankoil, Tamil Nadu 626190' },
  { name: 'Kalasalingam Hospital', address: 'Kalasalingam University Campus, Krishnankoil, Tamil Nadu 626126' },
  { name: 'Government Hospital Krishnankoil', address: 'Near College, Krishnankoil, Tamil Nadu 626190' },
  { name: 'Apollo Hospitals', address: '21, Greams Lane, Off Greams Road, Chennai, Tamil Nadu 600006' },
  { name: 'Fortis Malar Hospital', address: '52, 1st Main Road, Gandhi Nagar, Adyar, Chennai, Tamil Nadu 600020' },
  { name: 'MIOT International', address: '4/112, Mount Poonamallee Road, Manapakkam, Chennai, Tamil Nadu 600089' },
  { name: 'Sri Ramachandra Medical Centre', address: 'No.1, Ramachandra Nagar, Porur, Chennai, Tamil Nadu 600116' },
  { name: 'Global Hospitals', address: '439, Cheran Nagar, Sholinganallur, Chennai, Tamil Nadu 600100' },
  { name: 'Kauvery Hospital', address: '199, EVR Periyar Salai, Kilpauk, Chennai, Tamil Nadu 600010' },
  { name: 'Vijaya Hospital', address: 'No. 180, NSK Salai, Vadapalani, Chennai, Tamil Nadu 600026' },
  { name: 'Sankara Nethralaya', address: '41, College Road, Chennai, Tamil Nadu 600006' },
  { name: 'Madras Medical Mission', address: '4A, Dr. J Jayalalitha Nagar, Mogappair, Chennai, Tamil Nadu 600037' },
  { name: 'Christian Medical College (CMC)', address: 'Ida Scudder Road, Vellore, Tamil Nadu 632004' },
  { name: 'Government Rajaji Hospital', address: 'Goripalayam, Madurai, Tamil Nadu 625002' },
  { name: 'Ganga Hospital', address: '313, Mettupalayam Road, Coimbatore, Tamil Nadu 641043' },
  { name: 'PSG Hospitals', address: 'Peelamedu, Coimbatore, Tamil Nadu 641004' },
  { name: 'Kovai Medical Center and Hospital', address: 'Avanashi Road, Coimbatore, Tamil Nadu 641014' },
  { name: 'Meenakshi Mission Hospital', address: 'Lake Area, Melur Road, Madurai, Tamil Nadu 625107' },
  { name: 'Government General Hospital', address: 'Park Town, Chennai, Tamil Nadu 600003' },
  { name: 'Stanley Medical College Hospital', address: 'No.1, Old Jail Road, Royapuram, Chennai, Tamil Nadu 600001' },
  { name: 'Kumbakonam Government Hospital', address: 'Hospital Road, Kumbakonam, Tamil Nadu 612001' },
  { name: 'Anbu Hospital', address: 'No. 4 & 5, Lakshmi Vilas Street, Kumbakonam – 612001, Thanjavur District, Tamil Nadu, India' },
];

const urgencyLevels = [
  { label: 'Critical', value: 'critical', color: '#F44336', duration: 30 * 60 * 1000, icon: 'alert-octagon', description: 'Need within 30 mins' },
  { label: 'Emergency', value: 'emergency', color: '#FF5722', duration: 1 * 60 * 60 * 1000, icon: 'alert', description: 'Need within 1 hour' },
  { label: 'Priority', value: 'priority', color: '#FF9800', duration: 6 * 60 * 60 * 1000, icon: 'arrow-up', description: 'Need within 6 hours' },
  { label: 'Routine', value: 'routine', color: '#4CAF50', duration: 48 * 60 * 60 * 1000, icon: 'clock-outline', description: 'Need within 48 hours' }
];

const CreateRequestScreen = ({ navigation }) => {
  const [bloodGroup, setBloodGroup] = useState('');
  const [units, setUnits] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [hospital, setHospital] = useState('');
  const [hospitalQuery, setHospitalQuery] = useState('');
  const [hospitalSuggestions, setHospitalSuggestions] = useState([]);
  const [contact, setContact] = useState('');
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  // Remove address fields, only use hospital address
  const [urgency, setUrgency] = useState(null);

  useEffect(() => {
    if (hospitalQuery.length > 0) {
      const filtered = validHospitals.filter(h => h.name.toLowerCase().includes(hospitalQuery.toLowerCase()));
      setHospitalSuggestions(filtered);
    } else {
      setHospitalSuggestions([]);
    }
  }, [hospitalQuery]);

  const handleRequest = async () => {
    const userId = auth.currentUser ? auth.currentUser.uid : null;
    if (!userId) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }
    const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, userId));
    const userData = userDoc.exists() ? userDoc.data() : {};
    if (!userData.name || !userData.phoneNumber || !userData.bloodGroup) {
      Alert.alert('Error', 'Please complete your profile before creating a request.');
      return;
    }
    // Rate limiting: check active requests
    const activeRequestsSnapshot = await import('firebase/firestore').then(firestore =>
      firestore.getDocs(
        firestore.query(
          firestore.collection(db, 'requests'),
          firestore.where('userId', '==', userId),
          firestore.where('status', '==', 'active')
        )
      )
    );
    const activeRequestsCount = activeRequestsSnapshot.size;
    if (activeRequestsCount >= 2) {
      Alert.alert('Error', 'You can only have 2 active requests at a time.');
      return;
    }
    // Request validation
    const hospitalMatch = validHospitals.find(h => hospital.toLowerCase().includes(h.name.toLowerCase()));
    if (!hospitalMatch) {
      Alert.alert('Error', 'Please enter a valid hospital name located in Tamil Nadu.');
      return;
    }
    if (Number(units) < 1 || Number(units) > 10) {
      Alert.alert('Error', 'Units needed must be between 1 and 10.');
      return;
    }
    if (!['critical', 'emergency', 'priority', 'routine'].includes(urgency)) {
      Alert.alert('Error', 'Please select a valid urgency level.');
      return;
    }
    let flagged = false;
    if (urgency === 'critical' && Number(units) > 5) flagged = true;
    setLoading(true);
    try {
      // Geocode hospital address to get coordinates
      let location = null;
      try {
        const geocode = await Location.geocodeAsync(hospitalMatch.address);
        if (geocode && geocode.length > 0) {
          location = {
            latitude: geocode[0].latitude,
            longitude: geocode[0].longitude
          };
        }
      } catch (e) {
        console.warn('Geocoding failed:', e);
      }
      const docRef = await addDoc(collection(db, 'requests'), {
        bloodGroup,
        units: Number(units),
        hospital,
        contact,
        address: hospitalMatch.address, // Use hospital address only
        location, // Save geocoded location
        status: 'active',
        userId,
        createdAt: serverTimestamp(),
        urgency,
        flagged,
        patientName,
        patientAge,
        donors: [], // Array of { userId, units: 1 }
        unitsFulfilled: 0 // Track how many units have been donated
      });
      const urgencyLevel = urgencyLevels.find(level => level.value === urgency);
      setTimeout(async () => {
        await deleteDoc(docRef);
      }, urgencyLevel.duration);
      Alert.alert('Success', 'Request created successfully', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (error) {
      setError('Failed to create request: ' + error.message);
      setVisible(true);
    } finally {
      setLoading(false);
    }
  };

  // Donor acceptance logic
  const acceptRequestAsDonor = async (requestId, recipientBloodGroup, unitsRequested) => {
    const donorId = auth.currentUser ? auth.currentUser.uid : null;
    if (!donorId) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }
    // Get donor profile
    const donorDoc = await getDoc(doc(db, COLLECTIONS.USERS, donorId));
    const donorData = donorDoc.exists() ? donorDoc.data() : {};
    if (!donorData.bloodGroup) {
      Alert.alert('Error', 'Please complete your profile to donate.');
      return;
    }
    // Check last donation date (assume donorData.lastDonation is a Firestore Timestamp)
    if (donorData.lastDonation) {
      const lastDonationDate = donorData.lastDonation.toDate ? donorData.lastDonation.toDate() : new Date(donorData.lastDonation);
      const now = new Date();
      const diffDays = Math.floor((now - lastDonationDate) / (1000 * 60 * 60 * 24));
      if (diffDays < 90) {
        Alert.alert('Error', `You must wait ${90 - diffDays} more days before donating again.`);
        return;
      }
    }
    // Get donor's current location
    let donorLocation = null;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        donorLocation = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude
        };
      }
    } catch (e) {
      // Location not available
    }
    // Get request
    const requestDoc = await getDoc(doc(db, 'requests', requestId));
    if (!requestDoc.exists()) {
      Alert.alert('Error', 'Request not found.');
      return;
    }
    const requestData = requestDoc.data();
    // Check compatibility
    if (!isBloodGroupCompatible(donorData.bloodGroup, recipientBloodGroup)) {
      Alert.alert('Error', 'Your blood group is not compatible for this request.');
      return;
    }
    // Check if already fulfilled
    if (requestData.unitsFulfilled >= unitsRequested) {
      Alert.alert('Error', 'Request already fulfilled.');
      return;
    }
    // Check if donor already added
    if (requestData.donors && requestData.donors.some(d => d.userId === donorId)) {
      Alert.alert('Error', 'You have already accepted this request.');
      return;
    }
    // Add donor and increment unitsFulfilled
    try {
      await updateDoc(doc(db, 'requests', requestId), {
        donors: arrayUnion({ userId: donorId, units: 1 }),
        unitsFulfilled: (requestData.unitsFulfilled || 0) + 1
      });
      // Update donor's lastDonation field and save location only if valid
      const donorUpdate = {
        lastDonation: new Date()
      };
      if (
        donorLocation &&
        typeof donorLocation.latitude === 'number' &&
        typeof donorLocation.longitude === 'number'
      ) {
        donorUpdate.donorLocation = donorLocation;
      }
      await updateDoc(doc(db, COLLECTIONS.USERS, donorId), donorUpdate);
      Alert.alert('Success', 'You have accepted this request as a donor.');
    } catch (error) {
      Alert.alert('Error', 'Failed to accept request: ' + error.message);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={styles.container}>
          <Card style={styles.card}>
            <Title style={styles.title}>Request Blood</Title>
            {/* Patient Information Section */}
            <Text style={styles.sectionTitle}>Patient Information</Text>
            <TextInput
              label="Patient Name"
              value={patientName}
              onChangeText={setPatientName}
              style={styles.input}
            />
            <TextInput
              label="Patient Age"
              value={patientAge}
              onChangeText={setPatientAge}
              keyboardType="numeric"
              style={styles.input}
            />
            {/* Request Details Section */}
            <Text style={styles.sectionTitle}>Request Details</Text>
            <Text style={styles.subSectionTitle}>Blood Group</Text>
            <SegmentedButtons
              value={bloodGroup}
              onValueChange={setBloodGroup}
              style={styles.segmentedButton}
              buttons={[
                { value: 'A+', label: 'A+' },
                { value: 'B+', label: 'B+' },
                { value: 'O+', label: 'O+' },
                { value: 'AB+', label: 'AB+' },
              ]}
            />
            <SegmentedButtons
              value={bloodGroup}
              onValueChange={setBloodGroup}
              style={styles.segmentedButton}
              buttons={[
                { value: 'A-', label: 'A-' },
                { value: 'B-', label: 'B-' },
                { value: 'O-', label: 'O-' },
                { value: 'AB-', label: 'AB-' },
              ]}
            />
            <TextInput
              label="Units Needed"
              value={units}
              onChangeText={setUnits}
              keyboardType="numeric"
              style={styles.input}
            />
            <Text style={styles.subSectionTitle}>Medical Urgency Level</Text>
            <View style={styles.urgencyWrapper}>
              <View style={styles.urgencyContainer}>
                {urgencyLevels.map(level => (
                  <TouchableOpacity
                    key={level.value}
                    onPress={() => setUrgency(level.value)}
                    style={[ 
                      styles.urgencyButton,
                      urgency === level.value && {
                        backgroundColor: `${level.color}15`,
                        borderColor: level.color,
                        borderWidth: 1.5,
                        elevation: 0,
                        shadowColor: 'transparent'
                      }
                    ]}
                  >
                    <View style={[styles.urgencyDot, { backgroundColor: level.color }]}>
                      <Icon name={level.icon} size={14} color="white" />
                    </View>
                    <View style={styles.urgencyContent}>
                      <Text
                        style={[ 
                          styles.urgencyButtonText,
                          urgency === level.value && { color: level.color }
                        ]}
                      >
                        {level.label}
                      </Text>
                      <Text style={styles.urgencyTime}>
                        {level.description}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {/* Hospital Information Section */}
            <Text style={styles.sectionTitle}>Hospital Information</Text>
            <View style={{ zIndex: 10, position: 'relative' }}>
              <Autocomplete
                data={hospitalSuggestions}
                defaultValue={hospitalQuery}
                onChangeText={text => {
                  setHospitalQuery(text);
                  setHospital(text);
                }}
                flatListProps={{
                  keyExtractor: (item) => item.name,
                  renderItem: ({ item }) => (
                    <TouchableOpacity
                      onPress={() => {
                        setHospital(item.name);
                        setHospitalQuery(item.name);
                        setHospitalSuggestions([]);
                      }}
                      style={{ padding: 8 }}
                    >
                      <Text>{item.name}</Text>
                      <Text style={{ fontSize: 10, color: '#888' }}>{item.address}</Text>
                    </TouchableOpacity>
                  ),
                }}
                inputContainerStyle={{ ...styles.input, zIndex: 10 }}
                listContainerStyle={{
                  position: 'absolute',
                  top: 50,
                  left: 0,
                  right: 0,
                  zIndex: 20,
                  backgroundColor: 'white',
                  borderRadius: 8,
                  elevation: 5,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 4,
                  maxHeight: 200
                }}
                placeholder="Hospital Name"
              />
            </View>
            <TextInput
              label="Contact Number"
              value={contact}
              onChangeText={setContact}
              keyboardType="phone-pad"
              style={styles.input}
            />
            {/* Address Section Removed: Address is now set to hospital address automatically */}
            {/* Submit & Report Buttons */}
            <Button
              mode="contained"
              onPress={handleRequest}
              style={styles.button}
              loading={loading}
              disabled={loading}
            >
              Submit Request
            </Button>
            {/* Report Suspicious Request button removed from Create Request form */}
          </Card>
          {/* Address confirmation dialog removed */}
          <Snackbar
            visible={visible}
            onDismiss={() => setVisible(false)}
            duration={3000}
          >
            {error}
          </Snackbar>
        </View>
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
    paddingHorizontal: 8
  },
  card: {
    margin: 8,
    padding: 16,
    backgroundColor: 'white',
    elevation: 3,
    borderRadius: 12,
    // overflow: 'hidden' // REMOVE to allow dropdown to show
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ff6f61',
    textAlign: 'center',
    marginBottom: 20
  },
  input: {
    marginVertical: 8,
    backgroundColor: 'white',
    borderRadius: 8
  },
  segmentedButton: {
    marginVertical: 6,
    width: '100%'
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
    marginTop: 8,
    color: '#555',
  },
  segmentedButtonContainer: {
    padding: 8
  },
  bloodGroupContainer: {
    marginVertical: 12,
    width: '100%'
  },
  bloodGroupRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    width: '100%'
  },
  button: {
    marginVertical: 12,
    backgroundColor: '#ff6f61',
    borderRadius: 8,
    elevation: 2,
    paddingVertical: 8
  },
  locationButton: {
    marginBottom: 16,
    backgroundColor: '#ff6f61',
    borderRadius: 8
  },
  submitButton: {
    marginTop: 24,
    backgroundColor: '#ff6f61',
    borderRadius: 8,
    elevation: 3,
    paddingVertical: 8
  },
  addressInput: {
    marginVertical: 12,
    backgroundColor: 'white',
    borderRadius: 8,
    minHeight: 80
  },
  urgencyLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: 'white',
  },
  radioButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  urgencyWrapper: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  urgencyContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 8,
    width: '100%',
  },
  urgencyCard: {
    width: '48%',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 16,
    overflow: 'hidden',
    backgroundColor: 'white',
    borderRadius: 12,
    elevation: 3,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  urgencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    padding: 12,
    gap: 8,
  },
  urgencyDescription: {
    padding: 8,
    fontSize: 14,
    color: '#555',
    fontSize: 14,
    color: '#666',
    padding: 12,
    paddingTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 8,
    color: '#333',
  },
  urgencyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    width: 140,
    height: 55,
    elevation: 0,
    shadowColor: 'transparent'
  },
  urgencyDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  urgencyContent: {
    flex: 1,
    justifyContent: 'center',
  },
  urgencyButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 2,
  },
  urgencyTime: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
});

export default CreateRequestScreen;