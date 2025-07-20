import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Image, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Avatar, Card, Title, Paragraph, Button, Surface, IconButton, Divider, TextInput, Switch, List } from 'react-native-paper';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db, storage, COLLECTIONS } from '../../services/firebase/config';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { signOut } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { Text } from 'react-native-paper';
import * as ImageManipulator from 'expo-image-manipulator';
// import { format } from 'date-fns';

const ProfileScreen = ({ navigation, route }) => {
  const initialProfile = {
    name: '',
    bloodGroup: '',
    phoneNumber: '',
    isAvailable: true,
    address: '',
    lastDonation: null,
    donationCount: 0,
    photoURL: null
  };

  const [profile, setProfile] = useState(
    route?.params?.profile || initialProfile
  );
  const [loading, setLoading] = useState(true);
  const [photoURL, setPhotoURL] = useState(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, auth.currentUser.uid));
        if (userDoc.exists()) {
          setProfile(userDoc.data());
          setPhotoURL(userDoc.data().photoURL);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
        Alert.alert('Error', 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    if (!route?.params?.profile) {
      loadProfile();
    }
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      await AsyncStorage.removeItem('user');
      navigation.reset({
        index: 0,
        routes: [{ name: 'Landing' }]
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const pickImage = async () => {
    try {
      // Request permissions first
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please allow access to your photo library');
        return;
      }
  
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });
  
      if (!result.canceled) {
        const imageUri = result.assets[0].uri;
        await uploadProfileImage(imageUri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const compressImage = async (uri) => {
    try {
      const manipulateResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 500 } }],
        { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
      );
      return manipulateResult.uri;
    } catch (error) {
      console.error('Error compressing image:', error);
      throw error;
    }
  };

  const uploadProfileImage = async (uri) => {
    if (!auth.currentUser) {
      Alert.alert('Error', 'You must be logged in to upload a profile photo');
      return;
    }
  
    try {
      setLoading(true);
      const userId = auth.currentUser.uid;
  
      // Compress image
      const compressedUri = await compressImage(uri);
      const response = await fetch(compressedUri);
      const blob = await response.blob();
      
      // Create unique filename with timestamp
      const timestamp = Date.now();
      const storageRef = ref(storage, `profiles/${userId}/profile_${timestamp}.jpg`);
      
      // Upload with metadata
      const metadata = {
        contentType: 'image/jpeg',
        customMetadata: {
          'userId': userId,
          'uploadedAt': timestamp.toString()
        }
      };
      
      await uploadBytes(storageRef, blob, metadata);
      const downloadURL = await getDownloadURL(storageRef);
  
      // Update Firestore profile
      const userRef = doc(db, COLLECTIONS.USERS, userId);
      await updateDoc(userRef, {
        photoURL: downloadURL,
        updatedAt: new Date()
      });
  
      setProfile(prev => ({ ...prev, photoURL: downloadURL }));
      Alert.alert('Success', 'Profile photo updated successfully');
    } catch (error) {
      console.error('Error uploading image:', error);
      
      // More specific error messages
      if (error.code === 'storage/unauthorized') {
        Alert.alert('Permission Denied', 
          'You do not have permission to upload photos. Please try logging in again.');
      } else {
        Alert.alert('Upload Failed', 
          'Could not upload profile photo. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      setLoading(true);
      await updateDoc(doc(db, COLLECTIONS.USERS, auth.currentUser.uid), {
        ...profile,
        updatedAt: new Date()
      });
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp || !timestamp.seconds) return 'No donation yet';
    try {
      const date = new Date(timestamp.seconds * 1000);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Surface style={styles.header}>
        <TouchableOpacity onPress={pickImage} disabled={loading}>
          {photoURL ? (
            <Image source={{ uri: photoURL }} style={styles.profileImage} />
          ) : (
            <Avatar.Icon 
              size={120} 
              icon="account"
              style={styles.avatar}
            />
          )}
          <View style={styles.editIconContainer}>
            {loading ? (
              <ActivityIndicator size={20} color="white" />
            ) : (
              <Icon name="camera" size={20} color="white" />
            )}
          </View>
        </TouchableOpacity>
        
        <Title style={styles.name}>{profile?.name}</Title>
        <View style={styles.bloodGroupBadge}>
          <Text style={styles.bloodGroupText}>{profile?.bloodGroup}</Text>
        </View>
      </Surface>

      <View style={styles.statsContainer}>
        <Card style={styles.statsCard}>
          <Card.Content>
            <Title style={styles.statNumber}>{profile?.donationCount || 0}</Title>
            <Paragraph>Donations</Paragraph>
          </Card.Content>
        </Card>

        <Card style={styles.statsCard}>
          <Card.Content>
            <Title style={styles.statNumber}>{profile?.livesImpacted || 0}</Title>
            <Paragraph>Lives Saved</Paragraph>
          </Card.Content>
        </Card>
      </View>

      <Card style={styles.detailsCard}>
        <Card.Content>
          <View style={styles.detailRow}>
            <Icon name="phone" size={24} color="#ff6f61" />
            <Paragraph>{profile?.phoneNumber}</Paragraph>
          </View>
          
          <View style={styles.detailRow}>
            <Icon name="email" size={24} color="#ff6f61" />
            <Paragraph>{profile?.email}</Paragraph>
          </View>

          <View style={styles.detailRow}>
            <Icon name="calendar" size={24} color="#ff6f61" />
            <Paragraph>Last Donation: {formatDate(profile?.lastDonation)}</Paragraph>
          </View>

          <View style={styles.detailRow}>
            <Icon name="hospital" size={24} color="#ff6f61" />
            <Paragraph>Medical Conditions: {profile?.medicalConditions || 'None'}</Paragraph>
          </View>
        </Card.Content>
      </Card>

      <TextInput
        label="Name"
        value={profile.name}
        onChangeText={(text) => setProfile({...profile, name: text})}
        style={styles.input}
      />

      <TextInput
        label="Phone Number"
        value={profile.phoneNumber}
        onChangeText={(text) => setProfile({...profile, phoneNumber: text})}
        style={styles.input}
        keyboardType="phone-pad"
      />

      <TextInput
        label="Address"
        value={profile.address}
        onChangeText={(text) => setProfile({...profile, address: text})}
        style={styles.input}
        multiline
      />

      <List.Item
        title="Available for Donation"
        right={() => (
          <Switch
            value={profile.isAvailable}
            onValueChange={(value) => setProfile({...profile, isAvailable: value})}
          />
        )}
      />

      <Button
        mode="contained"
        onPress={handleUpdateProfile}
        loading={loading}
        style={styles.button}
      >
        Update Profile
      </Button>

      <List.Section>
        <List.Subheader>Donation History</List.Subheader>
        <List.Item
          title="Total Donations"
          right={() => <Title>{profile.donationCount || 0}</Title>}
        />
        <List.Item
          title="Last Donation"
          description={
            profile.lastDonation && typeof profile.lastDonation.toDate === 'function'
              ? new Date(profile.lastDonation.toDate()).toLocaleDateString()
              : 'No donations yet'
          }
        />
      </List.Section>

      <Button
        mode="contained"
        style={styles.editButton}
        onPress={() => navigation.navigate('EditProfile')}
      >
        Edit Profile
      </Button>

      <Button
        mode="outlined"
        style={styles.logoutButton}
        icon="logout"
        onPress={handleLogout}
      >
        Logout
      </Button>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff5f5',
  },
  header: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: 'white',
    elevation: 4,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 16,
  },
  avatar: {
    backgroundColor: '#ff6f61',
    marginBottom: 16,
  },
  editIconContainer: {
    position: 'absolute',
    right: -6,
    bottom: 14,
    backgroundColor: '#ff6f61',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  bloodGroupBadge: {
    backgroundColor: '#ff6f61',
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 8,
  },
  bloodGroupText: {
    color: 'white',
    fontWeight: 'bold',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
  },
  statsCard: {
    width: '45%',
    elevation: 3,
    borderRadius: 12,
  },
  statNumber: {
    color: '#ff6f61',
    fontSize: 28,
    fontWeight: 'bold',
  },
  detailsCard: {
    margin: 16,
    borderRadius: 12,
    elevation: 3,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  input: {
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  button: {
    marginVertical: 16,
    backgroundColor: '#ff6f61',
  },
  editButton: {
    margin: 16,
    backgroundColor: '#ff6f61',
    paddingVertical: 8,
  },
  logoutButton: {
    margin: 16,
    borderColor: '#ff6f61',
    borderWidth: 2,
  },
});

export default ProfileScreen;