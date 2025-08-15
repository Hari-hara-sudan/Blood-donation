import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Platform, Dimensions } from 'react-native';
import { TextInput, Button, Text, Title, Surface, Divider, Card } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../../services/firebase/config';
import { doc, setDoc } from 'firebase/firestore';
import * as Location from 'expo-location';
import { SegmentedButtons } from 'react-native-paper';
import { serverTimestamp } from 'firebase/firestore';
import DateTimePicker from '@react-native-community/datetimepicker';

const { width } = Dimensions.get('window');

const getCurrentLocation = async () => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.log('Location permission denied');
      return null; // Return null instead of throwing error
    }
    const location = await Location.getCurrentPositionAsync({});
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude
    };
  } catch (error) {
    console.log('Location error:', error);
    return null; // Fallback to null
  }
};

const RegisterScreen = ({ navigation }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [lastDonation, setLastDonation] = useState('');
  const [medicalConditions, setMedicalConditions] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const iso = selectedDate.toISOString().split('T')[0];
      setLastDonation(iso);
    }
  };

  const validate = () => {
    const errors = {};
    if (!name) errors.name = 'Full Name is required';
    if (!email) errors.email = 'Email is required';
    if (!password) errors.password = 'Password is required';
    if (!bloodGroup) errors.bloodGroup = 'Blood Group is required';
    if (!age) errors.age = 'Age is required';
    if (!weight) errors.weight = 'Weight is required';
    if (!phoneNumber) errors.phoneNumber = 'Phone Number is required';
    if (age && (Number(age) < 18 || Number(age) > 65)) errors.age = 'Age must be between 18 and 65';
    if (weight && Number(weight) < 50) errors.weight = 'Weight must be at least 50 kg';
    return errors;
  };

  const handleRegister = async () => {
    setError('');
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setLoading(true);
    try {
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
        location: location || { latitude: 0, longitude: 0 }, // Fallback location
        isAvailable: true,
        donationCount: 0,
        lastUpdated: serverTimestamp(),
        createdAt: serverTimestamp(),

      });
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    } catch (error) {
      console.error('Registration error:', error);
      setError(error.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff5f5' }}>
      {/* Compact Header */}
      <View style={styles.compactHeader}>
        <Icon name="account-plus" size={48} color="#ff6f61" style={{ marginBottom: 4 }} />
        <Title style={styles.compactTitle}>Join Our Community</Title>
        <Text style={styles.compactSubtitle}>Be a lifesaver, Register now</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={styles.formCard}>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* Personal Info Section */}
          <View style={styles.sectionHeaderRow}>
            <Icon name="account" size={22} color="#ff6f61" style={{ marginRight: 6 }} />
            <Text style={styles.sectionHeader}>Personal Info</Text>
          </View>
          <TextInput
            label="Full Name *"
            value={name}
            onChangeText={setName}
            style={styles.input}
            mode="outlined"
            left={<TextInput.Icon icon="account" color="#ff6f61" />}
            theme={{ colors: { primary: '#ff6f61' } }}
            error={!!fieldErrors.name}
            contentStyle={styles.inputContent}
          />
          {fieldErrors.name ? <Text style={styles.fieldError}>{fieldErrors.name}</Text> : null}

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
            error={!!fieldErrors.email}
            contentStyle={styles.inputContent}
          />
          {fieldErrors.email ? <Text style={styles.fieldError}>{fieldErrors.email}</Text> : null}

          <TextInput
            label="Phone Number *"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            style={styles.input}
            mode="outlined"
            keyboardType="phone-pad"
            left={<TextInput.Icon icon="phone" color="#ff6f61" />}
            theme={{ colors: { primary: '#ff6f61' } }}
            error={!!fieldErrors.phoneNumber}
            contentStyle={styles.inputContent}
          />
          {fieldErrors.phoneNumber ? <Text style={styles.fieldError}>{fieldErrors.phoneNumber}</Text> : null}

          <TextInput
            label="Password *"
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            mode="outlined"
            secureTextEntry={!showPassword}
            left={<TextInput.Icon icon="lock" color="#ff6f61" />}
            right={
              <TextInput.Icon
                icon={showPassword ? 'eye-off' : 'eye'}
                color="#ff6f61"
                onPress={() => setShowPassword(!showPassword)}
                forceTextInputFocus={false}
              />
            }
            theme={{ colors: { primary: '#ff6f61' } }}
            error={!!fieldErrors.password}
            contentStyle={styles.inputContent}
          />
          {fieldErrors.password ? <Text style={styles.fieldError}>{fieldErrors.password}</Text> : null}

          <Divider style={styles.divider} />

          {/* Health Info Section */}
          <View style={styles.sectionHeaderRow}>
            <Icon name="heart-pulse" size={22} color="#ff6f61" style={{ marginRight: 6 }} />
            <Text style={styles.sectionHeader}>Health Info</Text>
          </View>

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
          {fieldErrors.bloodGroup ? <Text style={styles.fieldError}>{fieldErrors.bloodGroup}</Text> : null}

          <TextInput
            label="Age *"
            value={age}
            onChangeText={setAge}
            style={styles.input}
            mode="outlined"
            keyboardType="numeric"
            left={<TextInput.Icon icon="calendar" color="#ff6f61" />}
            theme={{ colors: { primary: '#ff6f61' } }}
            error={!!fieldErrors.age}
            contentStyle={styles.inputContent}
          />
          {fieldErrors.age ? <Text style={styles.fieldError}>{fieldErrors.age}</Text> : null}

          <TextInput
            label="Weight (kg) *"
            value={weight}
            onChangeText={setWeight}
            style={styles.input}
            mode="outlined"
            keyboardType="numeric"
            left={<TextInput.Icon icon="weight" color="#ff6f61" />}
            theme={{ colors: { primary: '#ff6f61' } }}
            error={!!fieldErrors.weight}
            contentStyle={styles.inputContent}
          />
          {fieldErrors.weight ? <Text style={styles.fieldError}>{fieldErrors.weight}</Text> : null}

          <TouchableOpacity onPress={() => setShowDatePicker(true)}>
            <TextInput
              label="Last Donation Date (if any)"
              value={lastDonation}
              style={styles.input}
              mode="outlined"
              placeholder="YYYY-MM-DD"
              left={<TextInput.Icon icon="calendar" color="#ff6f61" />}
              theme={{ colors: { primary: '#ff6f61' } }}
              editable={false}
              pointerEvents="none"
              contentStyle={styles.inputContent}
            />
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={lastDonation ? new Date(lastDonation) : new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
              maximumDate={new Date()}
            />
          )}

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
            contentStyle={styles.inputContent}
          />

          <Button
            mode="contained"
            onPress={handleRegister}
            loading={loading}
            disabled={loading}
            style={styles.registerButton}
            labelStyle={styles.buttonLabel}
            contentStyle={{ height: 50 }}
          >
            Register
          </Button>
        </Card>
        <Divider style={styles.bottomDivider} />
        <View style={styles.loginContainer}>
          <Text style={styles.loginPrompt}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginLink}>Login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  heroSectionBg: {
    backgroundColor: '#ff6f61',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    paddingBottom: 32,
    paddingTop: 48,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    minHeight: 180,
    marginBottom: 0,
  },
  heroContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 6,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#fff',
    marginTop: 2,
    opacity: 0.9,
  },
  compactHeader: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 36,
    marginBottom: 24, // Increased from 8 to 24 for better separation
  },
  compactTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ff6f61',
    marginTop: 2,
  },
  compactSubtitle: {
    fontSize: 15,
    color: '#666',
    marginTop: 2,
    marginBottom: 2,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 0,
    paddingBottom: 32,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  formCard: {
    width: width > 500 ? 420 : '92%',
    alignSelf: 'center',
    marginTop: 0, // Remove negative margin
    padding: 20,
    borderRadius: 18,
    elevation: 5,
    backgroundColor: '#fff',
    shadowColor: '#ff6f61',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 2,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ff6f61',
    marginBottom: 8,
  },
  input: {
    marginVertical: 8,
    backgroundColor: '#fff8f6',
    borderRadius: 8,
    fontSize: 16,
  },
  inputContent: {
    fontSize: 16,
    paddingVertical: 10,
  },
  registerButton: {
    marginTop: 24,
    borderRadius: 8,
    backgroundColor: '#ff6f61',
    elevation: 2,
    width: '100%',
    alignSelf: 'center',
  },
  buttonLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    letterSpacing: 0.5,
  },
  error: {
    color: '#f44336',
    textAlign: 'center',
    marginBottom: 12,
    fontSize: 15,
  },
  fieldError: {
    color: '#f44336',
    marginLeft: 4,
    marginBottom: 2,
    fontSize: 13,
  },
  segmentedButton: {
    marginVertical: 8,
    marginHorizontal: 4,
  },
  divider: {
    marginVertical: 18,
    backgroundColor: '#ff6f61',
    height: 1.5,
    opacity: 0.15,
  },
  bottomDivider: {
    marginTop: 32,
    marginBottom: 12,
    backgroundColor: '#ff6f61',
    height: 1.2,
    opacity: 0.12,
    width: '80%',
    alignSelf: 'center',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 0,
    marginBottom: 24,
  },
  loginPrompt: {
    color: '#666',
    fontSize: 15,
  },
  loginLink: {
    color: '#ff6f61',
    fontWeight: 'bold',
    fontSize: 15,
    textDecorationLine: 'underline',
    marginLeft: 2,
  },
});

export default RegisterScreen;