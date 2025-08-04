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

  // Required fields for profile completeness
  const requiredFields = [
    { key: 'name', label: 'Name' },
    { key: 'bloodGroup', label: 'Blood Group' },
    { key: 'phoneNumber', label: 'Phone Number' }
  ];

  const [profile, setProfile] = useState(
    route?.params?.profile || initialProfile
  );

  // Check for missing required fields (guard against undefined profile)
  const getIncompleteFields = () => {
    if (!profile) return requiredFields;
    return requiredFields.filter(f => !profile[f.key] || (typeof profile[f.key] === 'string' && profile[f.key].trim() === ''));
  };
  const [incompleteFields, setIncompleteFields] = useState(getIncompleteFields());

  // Update incompleteFields whenever profile changes
  useEffect(() => {
    console.log('Profile state:', profile);
    setIncompleteFields(getIncompleteFields());
  }, [profile]);
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
      // Reload profile from Firestore after update
      const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, auth.currentUser.uid));
      if (userDoc.exists()) {
        setProfile(userDoc.data());
        setPhotoURL(userDoc.data().photoURL);
      }
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
      {/* Incomplete profile banner */}
      {incompleteFields.length > 0 && (
        <View style={styles.incompleteBanner}>
          <Icon name="alert-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.incompleteBannerText}>
            Please complete your profile: {incompleteFields.map(f => f.label).join(', ')}
          </Text>
        </View>
      )}

      {/* Header section */}
      <View style={styles.profileHeader}>
        <TouchableOpacity onPress={pickImage} disabled={loading} style={styles.profileImageWrapper}>
          {photoURL ? (
            <Image source={{ uri: photoURL }} style={styles.profileImageLarge} />
          ) : (
            <Avatar.Icon size={100} icon="account" style={styles.avatarLarge} />
          )}
          <View style={styles.editIconContainerLarge}>
            {loading ? (
              <ActivityIndicator size={18} color="white" />
            ) : (
              <Icon name="camera" size={18} color="white" />
            )}
          </View>
        </TouchableOpacity>
        <Title style={styles.profileName}>{profile?.name || 'Your Name'}</Title>
        <View style={styles.bloodGroupBadgeLarge}>
          <Text style={styles.bloodGroupTextLarge}>{profile?.bloodGroup || 'Blood Group'}</Text>
        </View>
      </View>

      {/* Stats section */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Icon name="heart" size={28} color="#ff6f61" />
          <Text style={styles.statNumberLarge}>{profile?.donationCount || 0}</Text>
          <Text style={styles.statLabel}>Donations</Text>
        </View>
        <View style={styles.statBox}>
          <Icon name="account-heart" size={28} color="#ff6f61" />
          <Text style={styles.statNumberLarge}>{profile?.livesImpacted || 0}</Text>
          <Text style={styles.statLabel}>Lives Saved</Text>
        </View>
      </View>

      {/* Info card */}
      <Card style={styles.infoCard}>
        <Card.Content>
          <View style={styles.infoRow}><Icon name="phone" size={20} color="#ff6f61" /><Text style={styles.infoText}>{profile?.phoneNumber || 'Phone Number'}</Text></View>
          <View style={styles.infoRow}><Icon name="email" size={20} color="#ff6f61" /><Text style={styles.infoText}>{profile?.email || 'Email'}</Text></View>
          <View style={styles.infoRow}><Icon name="calendar" size={20} color="#ff6f61" /><Text style={styles.infoText}>Last Donation: {formatDate(profile?.lastDonation)}</Text></View>
          <View style={styles.infoRow}><Icon name="hospital" size={20} color="#ff6f61" /><Text style={styles.infoText}>Medical Conditions: {profile?.medicalConditions || 'None'}</Text></View>
        </Card.Content>
      </Card>

      {/* Editable form section */}
      <View style={styles.formSection}>
        <TextInput
          label="Name"
          value={profile.name}
          onChangeText={(text) => setProfile({...profile, name: text})}
          style={[styles.input, !profile.name ? styles.incompleteInput : null]}
        />
        <TextInput
          label="Blood Group"
          value={profile.bloodGroup}
          onChangeText={(text) => setProfile({...profile, bloodGroup: text})}
          style={[styles.input, !profile.bloodGroup ? styles.incompleteInput : null]}
        />
        <TextInput
          label="Phone Number"
          value={profile.phoneNumber}
          onChangeText={(text) => setProfile({...profile, phoneNumber: text})}
          style={[styles.input, !profile.phoneNumber ? styles.incompleteInput : null]}
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
      </View>

      {/* Collapsible donation history */}
      <List.Accordion
        title="Donation History"
        left={props => <List.Icon {...props} icon="history" color="#ff6f61" />}
        style={styles.historyAccordion}
      >
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
      </List.Accordion>

      {/* Logout button at bottom */}
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
  incompleteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff6f61',
    padding: 10,
    margin: 10,
    borderRadius: 8,
    elevation: 2,
  },
  incompleteBannerText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 15,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: 'white',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 8,
    elevation: 2,
  },
  profileImageWrapper: {
    position: 'relative',
    marginBottom: 8,
  },
  profileImageLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#eee',
  },
  avatarLarge: {
    backgroundColor: '#ff6f61',
  },
  editIconContainerLarge: {
    position: 'absolute',
    right: -4,
    bottom: 4,
    backgroundColor: '#ff6f61',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
  profileName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  bloodGroupBadgeLarge: {
    backgroundColor: '#ff6f61',
    paddingHorizontal: 14,
    paddingVertical: 3,
    borderRadius: 16,
    marginTop: 6,
  },
  bloodGroupTextLarge: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 12,
    paddingHorizontal: 8,
  },
  statBox: {
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    width: '44%',
  },
  statNumberLarge: {
    color: '#ff6f61',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  infoCard: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 14,
    elevation: 2,
    backgroundColor: 'white',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  infoText: {
    fontSize: 15,
    color: '#333',
  },
  formSection: {
    marginHorizontal: 16,
    marginVertical: 12,
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 14,
    elevation: 2,
  },
  input: {
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  incompleteInput: {
    borderColor: '#ff6f61',
    borderWidth: 2,
  },
  button: {
    marginVertical: 16,
    backgroundColor: '#ff6f61',
    borderRadius: 8,
  },
  historyAccordion: {
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: 'white',
    borderRadius: 14,
    elevation: 2,
  },
  logoutButton: {
    margin: 16,
    borderColor: '#ff6f61',
    borderWidth: 2,
    borderRadius: 8,
  },
});

export default ProfileScreen;