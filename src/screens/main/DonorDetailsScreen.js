import React from 'react';
import { View, ScrollView, StyleSheet, Linking, Alert } from 'react-native';
import { Card, Title, Text, Button, Avatar, Paragraph } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../services/firebase/config';

const DonorDetailsScreen = ({ route, navigation }) => {
  const { donor } = route.params;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.acceptedBanner}>
            <Icon name="check-circle" size={20} color="#4CAF50" />
            <Text style={styles.acceptedText}>Request Accepted</Text>
          </View>

          <Title style={styles.donorTitle}>Donor Information</Title>
          <View style={styles.donorInfo}>
            <Avatar.Icon size={80} icon="account" style={styles.donorAvatar} />
            <View style={styles.donorDetails}>
              <Text style={styles.donorName}>{donor.name}</Text>
              <Text style={styles.donorBlood}>
                Blood Group: {donor.bloodGroup}
              </Text>
            </View>
          </View>

          <Button
            mode="contained"
            icon="phone"
            onPress={() => Linking.openURL(`tel:${donor.phoneNumber}`)}
            style={styles.callButton}
          >
            Call Donor
          </Button>

          <Button
            mode="outlined"
            onPress={() => navigation.goBack()}
            style={styles.closeButton}
          >
            Close
          </Button>
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const renderYourRequest = (request) => (
  <Card key={request.id} style={[styles.requestCard, styles.yourRequestCard]}>
    <Card.Content>
      <Title>{request.bloodGroup} Blood Needed</Title>
      <Paragraph>Hospital: {request.hospital}</Paragraph>
      <Paragraph>Units Needed: {request.units}</Paragraph>
      
      {request.donorDetails ? (
        <Button
          mode="contained"
          onPress={() => navigation.navigate('DonorDetails', { donor: request.donorDetails })}
          style={styles.viewDetailsButton}
        >
          View Donor Details
        </Button>
      ) : (
        <Button
          mode="contained"
          disabled
          style={styles.waitingButton}
        >
          Waiting for Donor
        </Button>
      )}

      <Button
        mode="outlined"
        onPress={async () => {
          try {
            const requestRef = doc(db, 'requests', request.id);
            await deleteDoc(requestRef);
            Alert.alert('Success', 'Request cancelled successfully');
          } catch (error) {
            console.error('Error deleting request:', error);
            Alert.alert('Error', 'Failed to cancel request');
          }
        }}
        style={styles.deleteButton}
        textColor="#FF5252"
      >
        Cancel Request
      </Button>
    </Card.Content>
  </Card>
);

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: 'white',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    elevation: 5,
  },
  acceptedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  acceptedText: {
    color: '#4CAF50',
    marginLeft: 8,
    fontWeight: 'bold',
    fontSize: 16,
  },
  donorTitle: {
    fontSize: 22,
    color: '#ff6f61',
    marginBottom: 16,
  },
  donorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  donorAvatar: {
    backgroundColor: '#ff6f61',
  },
  donorDetails: {
    marginLeft: 16,
    flex: 1,
  },
  donorName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  donorBlood: {
    fontSize: 16,
    color: '#666',
  },
  callButton: {
    marginTop: 16,
    backgroundColor: '#4CAF50',
  },
  closeButton: {
    marginTop: 12,
    borderColor: '#666',
  },
  requestCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    elevation: 5,
    marginBottom: 16,
  },
  yourRequestCard: {
    borderColor: '#ff6f61',
    borderWidth: 1,
  },
  viewDetailsButton: {
    marginTop: 16,
    backgroundColor: '#4CAF50',
  },
  waitingButton: {
    marginTop: 16,
    backgroundColor: '#FFEB3B',
  },
  deleteButton: {
    marginTop: 12,
    borderColor: '#FF5252',
  },
});

export default DonorDetailsScreen;