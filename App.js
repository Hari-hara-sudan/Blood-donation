import React from 'react';
import { StatusBar } from 'react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LocationProvider } from './src/context/LocationContext';

// Import screens
import HomeScreen from './src/screens/main/HomeScreen';
import LoginScreen from './src/screens/auth/LoginScreen';
import RegisterScreen from './src/screens/auth/RegisterScreen';
import ProfileScreen from './src/screens/main/ProfileScreen';
import RequestConfirmationScreen from './src/screens/main/RequestConfirmationScreen';
import CreateRequestScreen from './src/screens/CreateRequestScreen';
import AvailableRequestsScreen from './src/screens/main/AvailableRequestsScreen';
import DonorDetailsScreen from './src/screens/main/DonorDetailsScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <PaperProvider>
      <LocationProvider>
        <StatusBar
          backgroundColor="#ffffff"
          barStyle="dark-content"
        />
        <NavigationContainer>
          <Stack.Navigator
            screenOptions={{
              headerStyle: {
                backgroundColor: '#ffffff',
              },
              headerTintColor: '#ff6f61',
              headerTitleStyle: {
                fontWeight: 'bold',
              },
            }}
          >
            <Stack.Screen 
              name="Home" 
              component={HomeScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen 
              name="ConfirmRequest" 
              component={RequestConfirmationScreen}
              options={{ title: 'Confirm Request' }}
            />
            <Stack.Screen name="CreateRequest" component={CreateRequestScreen}/>
            <Stack.Screen 
              name="AvailableRequests" 
              component={AvailableRequestsScreen}
              options={{ 
                title: 'Available Requests',
                headerStyle: {
                  backgroundColor: '#ff6f61',
                },
                
                headerTintColor: '#fff',
              }}
            />
            <Stack.Screen 
              name="DonorDetails" 
              component={DonorDetailsScreen} // Register the new screen
              options={{ 
                title: 'Donor Details',
                headerStyle: {
                  backgroundColor: '#ff6f61',
                },
                headerTintColor: '#fff',
              }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </LocationProvider>
    </PaperProvider>
  );
}
