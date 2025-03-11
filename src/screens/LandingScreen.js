import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { Button, Text, Title, Surface } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const LandingScreen = ({ navigation }) => {
  return (
    <Surface style={styles.container}>
      <View style={styles.heroContainer}>
        <Icon name="blood-bag" size={100} color="#ff6f61" />
        <Title style={styles.title}>Blood Donation</Title>
        <Text style={styles.subtitle}>Give Blood, Save Lives</Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Icon name="water" size={30} color="#ff6f61" />
          <Text style={styles.statNumber}>1000+</Text>
          <Text style={styles.statLabel}>Donors</Text>
        </View>
        <View style={styles.statItem}>
          <Icon name="heart" size={30} color="#ff6f61" />
          <Text style={styles.statNumber}>500+</Text>
          <Text style={styles.statLabel}>Lives Saved</Text>
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <Button 
          mode="contained" 
          style={styles.loginButton}
          labelStyle={styles.buttonLabel}
          onPress={() => navigation.navigate('Login')}
        >
          Login
        </Button>
        <Button 
          mode="outlined" 
          style={styles.registerButton}
          labelStyle={styles.outlineButtonLabel}
          onPress={() => navigation.navigate('Register')}
        >
          Register
        </Button>
      </View>

      <Text style={styles.footer}>Every Drop Counts</Text>
    </Surface>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff5f5',
  },
  heroContainer: {
    alignItems: 'center',
    marginTop: 80,
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ff6f61',
    marginTop: 20,
    padding: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginTop: 10,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginBottom: 40,
  },
  statItem: {
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    elevation: 2,
    width: '40%',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ff6f61',
    marginTop: 10,
  },
  statLabel: {
    color: '#666',
    marginTop: 5,
  },
  buttonContainer: {
    padding: 20,
  },
  loginButton: {
    backgroundColor: '#ff6f61',
    padding: 5,
    marginVertical: 10,
    elevation: 2,
  },
  registerButton: {
    borderColor: '#ff6f61',
    borderWidth: 2,
    padding: 5,
    marginVertical: 10,
  },
  buttonLabel: {
    fontSize: 16,
    color: 'white',
    fontWeight: 'bold',
  },
  outlineButtonLabel: {
    fontSize: 16,
    color: '#ff6f61',
    fontWeight: 'bold',
  },
  footer: {
    textAlign: 'center',
    color: '#666',
    marginTop: 20,
    fontStyle: 'italic',
  }
});

export default LandingScreen;