import { Stack } from 'expo-router';

export default function Layout() {
  return (
    <Stack 
      screenOptions={{
        headerStyle: {
          backgroundColor: '#ff6f61',
        },
        headerTintColor: '#fff',
      }}
    />
  );
}