import { useLocalSearchParams } from 'expo-router';
import AvailableRequestsScreen from '../src/screens/main/AvailableRequestsScreen';

export default function Page() {
  const params = useLocalSearchParams();
  
  const availableRequests = params.requests ? JSON.parse(params.requests) : [];
  const urgencyLevels = params.levels ? JSON.parse(params.levels) : [];

  return (
    <AvailableRequestsScreen 
      availableRequests={availableRequests}
      urgencyLevels={urgencyLevels}
    />
  );
}