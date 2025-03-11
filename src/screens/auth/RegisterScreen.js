import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { TextInput, Button, Text, Title, Surface } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../../services/firebase/config';
import { doc, setDoc } from 'firebase/firestore';
import * as Location from 'expo-location';
import { SegmentedButtons } from 'react-native-paper';
import { serverTimestamp } from 'firebase/firestore';

const getCurrentLocation = async () => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Permission denied');
  }
  const location = await Location.getCurrentPositionAsync({});
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude
  };
};

const RegisterScreen = ({ navigation }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [lastDonation, setLastDonation] = useState('');
  const [medicalConditions, setMedicalConditions] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  const handleRegister = async () => {
    try {
      if (!name || !email || !password || !bloodGroup || !age || !weight || !phoneNumber) {
        setError('Please fill all required fields');
        return;
      }

      if (Number(age) < 18 || Number(age) > 65) {
        setError('Age must be between 18 and 65');
        return;
      }

      if (Number(weight) < 50) {
        setError('Weight must be at least 50 kg');
        return;
      }

      setLoading(true);
      const location = await getCurrentLocation();
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      await setDoc(doc(db, 'users', user.uid), {
        name,
        email,
        bloodGroup,
        age: Number(age),
        weight: Number(weight),
        lastDonation: lastDonation || null,
        medicalConditions: medicalConditions || 'None',
        phoneNumber,
        location: {
          latitude: location.latitude,
          longitude: location.longitude
        },
        isAvailable: true,
        donationCount: 0,
        lastUpdated: serverTimestamp(),
        createdAt: serverTimestamp()
      });
      
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.surfaceWrapper}>
        <Surface style={styles.formContainer}>
          <View style={styles.heroSection}>
            <Icon name="account-plus" size={80} color="#ff6f61" />
            <Title style={styles.title}>Join Our Community</Title>
            <Text style={styles.subtitle}>Be a lifesaver, Register now</Text>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TextInput
            label="Full Name *"
            value={name}
            onChangeText={setName}
            style={styles.input}
            mode="outlined"
            left={<TextInput.Icon icon="account" color="#ff6f61" />}
            theme={{ colors: { primary: '#ff6f61' } }}
          />

          <TextInput
            label="Email *"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
            left={<TextInput.Icon icon="email" color="#ff6f61" />}
            theme={{ colors: { primary: '#ff6f61' } }}
          />

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
            label="Age *"
            value={age}
            onChangeText={setAge}
            style={styles.input}
            mode="outlined"
            keyboardType="numeric"
            left={<TextInput.Icon icon="calendar" color="#ff6f61" />}
            theme={{ colors: { primary: '#ff6f61' } }}
          />

          <TextInput
            label="Weight (kg) *"
            value={weight}
            onChangeText={setWeight}
            style={styles.input}
            mode="outlined"
            keyboardType="numeric"
            left={<TextInput.Icon icon="weight" color="#ff6f61" />}
            theme={{ colors: { primary: '#ff6f61' } }}
          />

          <TextInput
            label="Phone Number *"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            style={styles.input}
            mode="outlined"
            keyboardType="phone-pad"
            left={<TextInput.Icon icon="phone" color="#ff6f61" />}
            theme={{ colors: { primary: '#ff6f61' } }}
          />

          <TextInput
            label="Last Donation Date (if any)"
            value={lastDonation}
            onChangeText={setLastDonation}
            style={styles.input}
            mode="outlined"
            placeholder="YYYY-MM-DD"
            left={<TextInput.Icon icon="calendar" color="#ff6f61" />}
            theme={{ colors: { primary: '#ff6f61' } }}
          />

          <TextInput
            label="Medical Conditions (if any)"
            value={medicalConditions}
            onChangeText={setMedicalConditions}
            style={styles.input}
            mode="outlined"
            multiline
            numberOfLines={3}
            left={<TextInput.Icon icon="medical-bag" color="#ff6f61" />}
            theme={{ colors: { primary: '#ff6f61' } }}
          />

          <TextInput
            label="Password *"
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            mode="outlined"
            secureTextEntry
            left={<TextInput.Icon icon="lock" color="#ff6f61" />}
            theme={{ colors: { primary: '#ff6f61' } }}
          />

          <Button
            mode="contained"
            onPress={handleRegister}
            loading={loading}
            disabled={loading}
            style={styles.registerButton}
            labelStyle={styles.buttonLabel}
          >
            Register
          </Button>

          <View style={styles.loginContainer}>
            <Text style={styles.loginPrompt}>Already have an account? </Text>
            <Text 
              style={styles.loginLink}
              onPress={() => navigation.navigate('Login')}
            >
              Login here
            </Text>
          </View>
        </Surface>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff5f5',
  },
  formContainer: {
    margin: 20,
    padding: 20,
    borderRadius: 15,
    elevation: 4,
    backgroundColor: 'white',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ff6f61',
    marginTop: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  input: {
    marginVertical: 8,
    backgroundColor: 'white',
  },
  registerButton: {
    marginTop: 24,
    paddingVertical: 8,
    backgroundColor: '#ff6f61',
    elevation: 2,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  error: {
    color: '#f44336',
    textAlign: 'center',
    marginBottom: 12,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  loginPrompt: {
    color: '#666',
  },
  loginLink: {
    color: '#ff6f61',
    fontWeight: 'bold',
  },
  segmentedButton: {
    marginVertical: 8,
    marginHorizontal: 4,
  },
  surfaceWrapper: {
    margin: 16,
    borderRadius: 12,
  }
});

export default RegisterScreen;