import React from 'react';
import { View, Text } from 'react-native';
import { Avatar, IconButton } from 'react-native-paper';
import { styles } from '../../styles/common';

export const HomeHeader = ({ navigation }) => {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Avatar.Icon size={40} icon="water" style={styles.icon} />
        <Text style={styles.headerTitle}>Blood Bank</Text>
      </View>
      <View style={styles.headerRight}>
        <IconButton
          icon="account"
          size={24}
          onPress={() => navigation.navigate('Profile')}
        />
      </View>
    </View>
  );
};