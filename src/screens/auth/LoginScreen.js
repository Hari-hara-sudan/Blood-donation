import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { TextInput, Button, Text, Title, Surface } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { signInWithEmailAndPassword } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../../services/firebase/config';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handleLogin = async () => {
    setEmailError('');
    setPasswordError('');
    setError('');
    let hasError = false;
    if (!email) {
      setEmailError('Email is required');
      hasError = true;
    }
    if (!password) {
      setPasswordError('Password is required');
      hasError = true;
    }
    if (hasError) return;
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await AsyncStorage.setItem('user', JSON.stringify(userCredential.user));
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    } catch (error) {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Surface style={styles.container}>
      <View style={styles.logoContainer}>
        <Icon name="blood-bag" size={80} color="#ff6f61" />
        <Title style={styles.title}>Blood Bank</Title>
      </View>

      <TextInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        mode="outlined"
        keyboardType="email-address"
        autoCapitalize="none"
        left={<TextInput.Icon icon="email" color="#ff6f61" />}
        theme={{ colors: { primary: '#ff6f61' } }}
        error={!!emailError}
      />
      {emailError ? <Text style={styles.fieldError}>{emailError}</Text> : null}

      <TextInput
        label="Password"
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
        error={!!passwordError}
      />
      {passwordError ? <Text style={styles.fieldError}>{passwordError}</Text> : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
        <Text style={styles.forgotPassword}>Forgot Password?</Text>
      </TouchableOpacity>

      <Button
        mode="contained"
        onPress={handleLogin}
        style={styles.button}
        loading={loading}
        disabled={loading}
        theme={{ colors: { primary: '#ff6f61' } }}
        labelStyle={styles.buttonLabel}
      >
        Login
      </Button>

      <View style={styles.registerContainer}>
        <Text style={styles.registerPrompt}>Don't have an account? </Text>
        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
          <Text style={styles.registerText}>Register</Text>
        </TouchableOpacity>
      </View>
    </Surface>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff5f5',
    padding: 20,
    paddingTop: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 80,
  },
  title: {
    fontSize: 28,
    marginTop: 10,
    color: '#ff6f61',
    fontWeight: 'bold',
  },
  input: {
    marginVertical: 8,
    backgroundColor: 'white',
  },
  button: {
    marginTop: 20,
    paddingVertical: 8,
    elevation: 2,
    backgroundColor: '#ff6f61',
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  error: {
    color: '#f44336',
    textAlign: 'center',
    marginBottom: 10,
    marginTop: 4,
  },
  fieldError: {
    color: '#f44336',
    marginLeft: 4,
    marginBottom: 2,
    fontSize: 13,
  },
  forgotPassword: {
    color: '#ff6f61',
    textAlign: 'right',
    marginTop: 8,
    marginBottom: 16,
    fontWeight: 'bold',
    fontSize: 15,
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
    alignItems: 'center',
  },
  registerPrompt: {
    color: '#666',
    fontSize: 15,
  },
  registerText: {
    color: '#ff6f61',
    fontWeight: 'bold',
    fontSize: 15,
    textDecorationLine: 'underline',
    marginLeft: 2,
  },
});

export default LoginScreen;