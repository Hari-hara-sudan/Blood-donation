import React from 'react';
import { View, StyleSheet, ScrollView, Linking } from 'react-native';
import { Card, Title, Text, Button, Avatar } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const DonorDetailsScreen = ({ route, navigation }) => {
  console.log('DonorDetailsScreen params:', route.params);
  const { donorDetails } = route.params || {};

  if (!donorDetails) {
    return (
      <View style={styles.container}>
        <Text>No donor details available</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.header}>
            <Avatar.Icon size={60} icon="account" style={styles.avatar} />
            <Title style={styles.name}>{donorDetails.name}</Title>
          </View>

          <View style={styles.details}>
            <Text style={styles.detail}>Blood Group: {donorDetails.bloodGroup}</Text>
            {donorDetails.phoneNumber && (
              <Button
                mode="contained"
                icon="phone"
                onPress={() => Linking.openURL(`tel:${donorDetails.phoneNumber}`)}
                style={styles.callButton}
              >
                Call Donor
              </Button>
            )}
          </View>
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  card: {
    margin: 16,
    elevation: 4,
  },
  header: {
    alignItems: 'center',
    marginVertical: 16,
  },
  avatar: {
    backgroundColor: '#ff6f61',
    marginBottom: 8,
  },
  name: {
    fontSize: 24,
    color: '#333',
  },
  details: {
    padding: 16,
  },
  detail: {
    fontSize: 16,
    marginBottom: 8,
  },
  callButton: {
    marginTop: 16,
    backgroundColor: '#4CAF50',
  },
});

export default DonorDetailsScreen;