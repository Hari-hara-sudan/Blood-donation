import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, Image, TouchableOpacity } from 'react-native';
import { TextInput, Button, Title, Paragraph, Checkbox, Text, Card, ActivityIndicator } from 'react-native-paper';
import { db, auth, storage, COLLECTIONS } from '../../services/firebase/config';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';

const ID_TYPES = [
  'Aadhaar',
  'PAN',
  'Voter ID',
  'Passport',
  'Driving License'
];

const regexValidators = {
  Aadhaar: /^\d{4}\s?\d{4}\s?\d{4}$/,
  PAN: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
  'Voter ID': /^[A-Z]{3}[0-9]{7}$/,
  Passport: /^[A-PR-WYa-pr-wy][1-9]\d{6}$/,
  'Driving License': /^[A-Z]{2}\d{2}\s?\d{11}$/
};

const KYCVerificationScreen = ({ navigation }) => {
  const [fullName, setFullName] = useState('');
  const [idType, setIdType] = useState(ID_TYPES[0]);
  const [idNumber, setIdNumber] = useState('');
  const [idImage, setIdImage] = useState(null);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  React.useEffect(() => {
    // Check if already submitted
    const fetchKYC = async () => {
      if (!auth.currentUser) return;
      const kycRef = doc(db, COLLECTIONS.KYC_VERIFICATION, auth.currentUser.uid);
      const kycSnap = await (await import('firebase/firestore')).getDoc(kycRef);
      if (kycSnap.exists()) {
        const data = kycSnap.data();
        setStatus(data.status || 'pending');
      }
    };
    fetchKYC();
  }, []);

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photo library');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (!result.canceled) {
      setIdImage(result.assets[0].uri);
    }
  };

  const validate = () => {
    if (!fullName.trim()) return 'Full Name is required';
    if (!idType) return 'ID Type is required';
    if (!idNumber.trim()) return 'ID Number is required';
    if (!idImage) return 'Please upload an image of your ID';
    if (!consent) return 'You must provide consent';
    const regex = regexValidators[idType];
    if (regex && !regex.test(idNumber.trim())) return `Invalid ${idType} format`;
    return null;
  };

  const handleSubmit = async () => {
    const error = validate();
    if (error) {
      Alert.alert('Validation Error', error);
      return;
    }
    setLoading(true);
    try {
      const userId = auth.currentUser.uid;
      // Upload image to storage
      const imgRef = ref(storage, `kyc/${userId}/id_front.jpg`);
      const response = await fetch(idImage);
      const blob = await response.blob();
      await uploadBytes(imgRef, blob, { contentType: 'image/jpeg' });
      const photoURL = await getDownloadURL(imgRef);
      // Save to Firestore
      await setDoc(doc(db, COLLECTIONS.KYC_VERIFICATION, userId), {
        userId,
        full_name: fullName,
        id_type: idType,
        id_number: idNumber.trim(),
        photo_url: photoURL,
        status: 'pending',
        submitted_at: new Date(),
      });
      // Set kyc_verified: false in users
      await updateDoc(doc(db, COLLECTIONS.USERS, userId), { kyc_verified: false });
      setStatus('pending');
      Alert.alert('Submitted', 'Your KYC is under verification.');
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to submit KYC. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'pending') {
    return (
      <View style={styles.centered}>
        <Card style={styles.statusCard}>
          <Card.Content>
            <Title>KYC Under Verification</Title>
            <Paragraph>Your KYC is being reviewed. You will be notified once it is approved.</Paragraph>
            <ActivityIndicator style={{ marginTop: 16 }} />
          </Card.Content>
        </Card>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Title style={styles.title}>KYC Verification</Title>
      <TextInput
        label="Full Name"
        value={fullName}
        onChangeText={setFullName}
        style={styles.input}
      />
      <Text style={styles.label}>Government ID Type</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        {ID_TYPES.map(type => (
          <Button
            key={type}
            mode={idType === type ? 'contained' : 'outlined'}
            onPress={() => setIdType(type)}
            style={styles.idTypeButton}
          >
            {type}
          </Button>
        ))}
      </ScrollView>
      <TextInput
        label="ID Number"
        value={idNumber}
        onChangeText={setIdNumber}
        style={styles.input}
        autoCapitalize="characters"
      />
      <Text style={styles.label}>Upload ID Image (Front Side)</Text>
      <TouchableOpacity onPress={pickImage} style={styles.imagePicker}>
        {idImage ? (
          <Image source={{ uri: idImage }} style={styles.idImage} />
        ) : (
          <View style={styles.placeholder}><Text>Tap to upload</Text></View>
        )}
      </TouchableOpacity>
      <View style={styles.checkboxRow}>
        <Checkbox
          status={consent ? 'checked' : 'unchecked'}
          onPress={() => setConsent(!consent)}
        />
        <Text style={{ flex: 1 }}>I consent to the use of my information for KYC verification.</Text>
      </View>
      <Button
        mode="contained"
        onPress={handleSubmit}
        loading={loading}
        style={styles.submitButton}
        disabled={loading}
      >
        Submit KYC
      </Button>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: '#fff5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#ff6f61',
  },
  input: {
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  label: {
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#333',
  },
  idTypeButton: {
    marginRight: 8,
    marginBottom: 8,
  },
  imagePicker: {
    height: 120,
    width: '100%',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  idImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: '#ff6f61',
    marginTop: 8,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff5f5',
    padding: 24,
  },
  statusCard: {
    padding: 24,
    borderRadius: 12,
    elevation: 3,
    backgroundColor: '#fff',
  },
});

export default KYCVerificationScreen; 