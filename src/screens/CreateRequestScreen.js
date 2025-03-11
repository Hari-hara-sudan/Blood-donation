import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, SafeAreaView, Alert, TouchableOpacity } from 'react-native';
import { TextInput, Button, Title, SegmentedButtons, Card, Snackbar, Dialog, Portal, Text } from 'react-native-paper';
import { collection, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebase/config'; // ✅ FIXED: Use `db` instead of `firestore`
import * as Location from 'expo-location';
import { Platform, StatusBar } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const CreateRequestScreen = ({ navigation }) => {
  const [bloodGroup, setBloodGroup] = useState('');
  const [units, setUnits] = useState('');
  const [hospital, setHospital] = useState('');
  const [contact, setContact] = useState('');
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const [address, setAddress] = useState('');
  const [showAddressDialog, setShowAddressDialog] = useState(false);
  const [tempAddress, setTempAddress] = useState('');
  const [urgency, setUrgency] = useState(null);

  const urgencyLevels = [
    { 
      label: 'Routine',
      value: 'routine',
      color: '#4CAF50',
      duration: 48 * 60 * 60 * 1000,
      icon: 'clock-outline',
      description: 'Need within 48 hours'
    },
    { 
      label: 'Priority',
      value: 'priority',
      color: '#FF9800',
      duration: 6 * 60 * 60 * 1000,
      icon: 'arrow-up',
      description: 'Need within 6 hours'
    },
    { 
      label: 'Emergency',
      value: 'emergency',
      color: '#FF5722',
      duration: 1 * 60 * 60 * 1000,
      icon: 'alert',
      description: 'Need within 1 hour'
    },
    { 
      label: 'Critical',
      value: 'critical',
      color: '#F44336',
      duration: 30 * 60 * 1000,
      icon: 'alert-octagon',
      description: 'Need within 30 mins'
    }
  ];

  const getCurrentLocation = async () => {
    try {
      setLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') throw new Error('Location permission denied');
      
      const location = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });

      // Reverse geocoding
      const reverseGeocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });

      if (reverseGeocode.length > 0) {
        const loc = reverseGeocode[0];
        const fullAddress = `${loc.street}, ${loc.city}, ${loc.region}, ${loc.postalCode}`;
        setAddress(fullAddress);
        setTempAddress(fullAddress);
        setShowAddressDialog(true);
      }

    } catch (error) {
      setError('Failed to get location: ' + error.message);
      setVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = async () => {
    if (!bloodGroup || !units || !hospital || !contact || !location || !urgency) {
      Alert.alert('Error', 'Please fill all fields and select urgency level');
      return;
    }

    setLoading(true);
    try {
      // ✅ FIXED: Use `db` instead of `firestore`
      const docRef = await addDoc(collection(db, 'requests'), {
        bloodGroup,
        units: Number(units),
        hospital,
        contact,
        location,
        address,
        status: 'active',
        userId: auth.currentUser ? auth.currentUser.uid : null,
        createdAt: serverTimestamp(),
        urgency
      });

      const urgencyLevel = urgencyLevels.find(level => level.value === urgency);
      setTimeout(async () => {
        await deleteDoc(docRef);
      }, urgencyLevel.duration);

      console.log('Request created with ID:', docRef.id);
      Alert.alert(
        'Success',
        'Request created successfully',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Error creating request:', error);
      Alert.alert('Error', `Failed to create request: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        <Card style={styles.card}>
          <Title style={styles.title}>Request Blood</Title>
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
          <TextInput
            label="Hospital Name"
            value={hospital}
            onChangeText={setHospital}
            style={styles.input}
          />
          <TextInput
            label="Contact Number"
            value={contact}
            onChangeText={setContact}
            keyboardType="phone-pad"
            style={styles.input}
          />
          <Button
            mode="contained"
            onPress={getCurrentLocation}
            style={styles.button}
            disabled={loading}
            icon={location ? "check" : "map-marker"}
          >
            {location ? 'Location Captured' : 'Get Current Location'}
          </Button>

          {address && (
            <TextInput
              label="Current Address"
              value={address}
              multiline
              numberOfLines={3}
              style={styles.input}
              disabled
            />
          )}

          <Text style={styles.sectionTitle}>Medical Urgency Level</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.urgencyContainer}
          >
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
                    elevation: 0, // Remove elevation when selected
                    shadowColor: 'transparent' // Remove shadow when selected
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
                    {level.description} {/* Display full description instead of splitting */}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Button
            mode="contained"
            onPress={handleRequest}
            style={styles.button}
            loading={loading}
            disabled={loading}
          >
            Submit Request
          </Button>
        </Card>

        <Portal>
          <Dialog visible={showAddressDialog} onDismiss={() => setShowAddressDialog(false)}>
            <Dialog.Title>Confirm Your Address</Dialog.Title>
            <Dialog.Content>
              <TextInput
                label="Address"
                value={tempAddress}
                onChangeText={setTempAddress}
                multiline
                numberOfLines={3}
              />
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setShowAddressDialog(false)}>Cancel</Button>
              <Button onPress={() => {
                setAddress(tempAddress);
                setShowAddressDialog(false);
              }}>Confirm</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>

        <Snackbar
          visible={visible}
          onDismiss={() => setVisible(false)}
          duration={3000}
        >
          {error}
        </Snackbar>
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
    overflow: 'hidden'
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
  urgencyContainer: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingRight: 8,
    gap: 8
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
    width: 140, // Increased width to fit longer text
    height: 55, // Slightly increased height
    elevation: 0, // Remove default elevation
    shadowColor: 'transparent' // Remove default shadow
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
