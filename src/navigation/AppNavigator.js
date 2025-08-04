// import React from 'react';
// import { createStackNavigator } from '@react-navigation/stack';
// import { NavigationContainer } from '@react-navigation/native';
// import { Provider as PaperProvider } from 'react-native-paper';

// // Screen imports
// import LandingScreen from '../screens/LandingScreen';
// import LoginScreen from '../screens/auth/LoginScreen';
// import RegisterScreen from '../screens/auth/RegisterScreen';
// import HomeScreen from '../screens/main/HomeScreen';
// import ProfileScreen from '../screens/main/ProfileScreen';
// import CreateRequestScreen from '../screens/CreateRequestScreen';
// import DonorDetailsScreen from '../screens/donor/DonorDetailsScreen';
// import AvailableRequestsScreen from '../screens/main/AvailableRequestsScreen';

// const Stack = createStackNavigator();

// const AppNavigator = ({ initialRoute = 'Landing' }) => {
//   return (
//     <NavigationContainer>
//       <PaperProvider>
//         <Stack.Navigator
//           initialRouteName={initialRoute}
//           screenOptions={{
//             headerTitleStyle: {
//               fontWeight: 'bold',
//             },
//           }}
//         >
//           <Stack.Screen 
//             name="Landing" 
//             component={LandingScreen} 
//             options={{ headerShown: false }} 
//           />
//           <Stack.Screen 
//             name="Login" 
//             component={LoginScreen}
//             options={{ headerShown: false }} 
//           />
//           <Stack.Screen 
//             name="Register" 
//             component={RegisterScreen}
//           />
//           <Stack.Screen 
//             name="Home" 
//             component={HomeScreen}
//             options={{ headerShown: false }} 
//           />
//           <Stack.Screen 
//             name="CreateRequest"
//             component={CreateRequestScreen}
//             options={{ title: 'Create Request' }}
//           />
//           <Stack.Screen 
//             name="DonorDetails"  
//             component={DonorDetailsScreen}
//             options={{
//               title: 'Donor Details',
//               headerTintColor: '#fff',
//               headerStyle: { backgroundColor: '#ff6f61' },
//             }}
//           />
//           <Stack.Screen
//             name="Profile"
//             component={ProfileScreen}
//             options={{
//               title: 'Profile',
//               headerTintColor: '#fff',
//               headerStyle: {
//                 backgroundColor: '#ff6f61',
//               },
//             }}
//           />
//           <Stack.Screen 
//             name="AvailableRequests"
//             component={AvailableRequestsScreen}
//             options={{
//               title: 'Available Requests',
//               headerTintColor: '#fff',
//               headerStyle: {
//                 backgroundColor: '#ff6f61',
//               },
//             }}
//           />
//         </Stack.Navigator>
//       </PaperProvider>
//     </NavigationContainer>
//   );
// };

// export default AppNavigator;