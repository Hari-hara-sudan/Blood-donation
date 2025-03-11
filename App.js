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
              name="RequestConfirmation" 
              component={RequestConfirmationScreen}
              options={{ title: 'Confirm Request' }}
            />
            <Stack.Screen name="CreateRequest" component={CreateRequestScreen}/>
          </Stack.Navigator>
        </NavigationContainer>
      </LocationProvider>
    </PaperProvider>
  );
}
