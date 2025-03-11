import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Button, Card, Title, Text, Surface, Paragraph } from 'react-native-paper';
import { doc, getDoc, updateDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { db, auth } from '../../services/firebase/config';

const RequestConfirmationScreen = ({ route, navigation }) => {
  const { request } = route.params;
  const [loading, setLoading] = useState(false);

  const handleConfirmation = async () => {
    try {
      setLoading(true);
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const userData = userDoc.data();
      
      const requestRef = doc(db, 'requests', request.id);
      
      // Update request with donor details
      await updateDoc(requestRef, {
        status: 'accepted',
        donorId: auth.currentUser.uid,
        donorDetails: {
          name: userData.name,
          phoneNumber: userData.phoneNumber,
          bloodGroup: userData.bloodGroup,
          photoURL: userData.photoURL || null,
          acceptedAt: serverTimestamp()
        }
      });

      // Create notification for requester
      await addDoc(collection(db, 'notifications'), {
        userId: request.userId,
        type: 'request_accepted',
        requestId: request.id,
        message: `${userData.name} has accepted your blood request`,
        createdAt: serverTimestamp(),
        read: false
      });

      Alert.alert(
        'Success',
        'Thank you for accepting this request!',
        [{ text: 'OK', onPress: () => navigation.navigate('Home') }]
      );
    } catch (error) {
      console.error('Error accepting request:', error);
      Alert.alert('Error', 'Failed to accept request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Surface style={styles.surface}>
        <Title style={styles.title}>Confirm Blood Donation</Title>
        
        <Card style={styles.card}>
          <Card.Content>
            <Title>Request Details</Title>
            <Paragraph>Blood Type: {request.bloodGroup}</Paragraph>
            <Paragraph>Units Needed: {request.units}</Paragraph>
            <Paragraph>Hospital: {request.hospital}</Paragraph>
            <Paragraph>Distance: {request.distance.toFixed(2)} km</Paragraph>
          </Card.Content>
        </Card>

        <View style={styles.warningCard}>
          <Text style={styles.warningText}>
            By accepting this request:
          </Text>
          <Text style={styles.bulletPoint}>• You agree to donate blood at the specified hospital</Text>
          <Text style={styles.bulletPoint}>• Your contact details will be shared with the requester</Text>
          <Text style={styles.bulletPoint}>• Please respond to the requester's calls</Text>
        </View>

        <View style={styles.buttonContainer}>
          <Button 
            mode="outlined" 
            onPress={() => navigation.goBack()}
            style={styles.cancelButton}
          >
            Cancel
          </Button>
          <Button 
            mode="contained" 
            onPress={handleConfirmation}
            style={styles.confirmButton}
            loading={loading}
            disabled={loading}
          >
            Confirm Donation
          </Button>
        </View>
      </Surface>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff5f5',
    padding: 16,
  },
  surface: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'white',
    elevation: 4,
  },
  title: {
    textAlign: 'center',
    color: '#ff6f61',
    marginBottom: 24,
    fontSize: 24,
    fontWeight: 'bold',
  },
  card: {
    marginBottom: 24,
  },
  warningCard: {
    backgroundColor: '#FFF3E0',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  warningText: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  bulletPoint: {
    marginLeft: 8,
    marginVertical: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    marginRight: 8,
    borderColor: '#ff6f61',
  },
  confirmButton: {
    flex: 1,
    marginLeft: 8,
    backgroundColor: '#ff6f61',
  },
  acceptedTime: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  }
});

export default RequestConfirmationScreen;