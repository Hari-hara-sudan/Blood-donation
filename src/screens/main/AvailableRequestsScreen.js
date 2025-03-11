import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { Card, Title, Paragraph, Text, Button } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import moment from 'moment';
import { Platform, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';

const AvailableRequestsScreen = ({ availableRequests, urgencyLevels }) => {
  const router = useRouter();
  const [timers, setTimers] = useState({});

  const getTimeLeft = (createdAt, duration) => {
    if (!createdAt) return '';
    const endTime = moment(createdAt).add(duration, 'milliseconds');
    const remaining = moment.duration(endTime.diff(moment()));
    
    if (remaining.asMilliseconds() <= 0) {
      return 'Expired';
    }

    const hours = Math.floor(remaining.asHours());
    const minutes = remaining.minutes();
    const seconds = remaining.seconds();

    return `${hours > 0 ? `${hours}h ` : ''}${minutes}m ${seconds}s`;
  };

  useEffect(() => {
    const timerInterval = setInterval(() => {
      const newTimers = {};
      availableRequests.forEach(request => {
        const urgencyLevel = urgencyLevels.find(level => level.value === request.urgency);
        const createdAt = request.createdAt?.toDate();
        newTimers[request.id] = getTimeLeft(createdAt, urgencyLevel?.duration);
      });
      setTimers(newTimers);
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [availableRequests]);

  const handleAcceptRequest = (request) => {
    router.push({
      pathname: "/request-confirmation",
      params: { request: JSON.stringify(request) }
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        <Title style={styles.title}>Available Blood Requests</Title>
        {availableRequests.length > 0 ? (
          availableRequests.map(request => {
            const urgencyLevel = urgencyLevels.find(level => level.value === request.urgency);
            const isExpired = timers[request.id] === 'Expired';

            return (
              <Card key={request.id} style={styles.requestCard}>
                <Card.Content>
                  <View style={styles.requestHeaderRow}>
                    <Title style={styles.bloodTitle}>{request.bloodGroup} Blood Needed</Title>
                    <View style={[styles.urgencyBadge, { backgroundColor: `${urgencyLevel?.color}15` }]}>
                      <View style={[styles.urgencyDot, { backgroundColor: urgencyLevel?.color }]} />
                      <Text style={[styles.urgencyText, { color: urgencyLevel?.color }]}>
                        {urgencyLevel?.label}
                      </Text>
                    </View>
                  </View>
                  
                  <Paragraph>Hospital: {request.hospital}</Paragraph>
                  <Paragraph>Units Needed: {request.units}</Paragraph>
                  <Paragraph>Distance: {request.distance?.toFixed(2)} km</Paragraph>
                  
                  <View style={styles.timerContainer}>
                    <Icon name="clock-outline" size={16} color={isExpired ? '#F44336' : urgencyLevel?.color} />
                    <Text style={[styles.timerText, { color: isExpired ? '#F44336' : urgencyLevel?.color }]}>
                      {timers[request.id]}
                    </Text>
                  </View>

                  <Button 
                    mode="contained" 
                    style={[styles.actionButton, isExpired && styles.disabledButton]}
                    onPress={() => handleAcceptRequest(request)}
                    disabled={isExpired}
                  >
                    {isExpired ? 'Request Expired' : 'Accept Request'}
                  </Button>
                </Card.Content>
              </Card>
            );
          })
        ) : (
          <Card style={styles.emptyCard}>
            <Card.Content>
              <Paragraph style={styles.emptyText}>No available requests in your area</Paragraph>
            </Card.Content>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: '#fff5f5',
      paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0
    },
    container: {
      flex: 1,
      paddingHorizontal: 8,
      paddingBottom: 80
    },
    title: {
      padding: 16,
      color: '#ff6f61',
      fontSize: 20,
      fontWeight: 'bold',
      marginTop: 8,
    },
    requestCard: {
      margin: 8,
      backgroundColor: 'white',
      elevation: 3,
      borderRadius: 12,
      overflow: 'hidden',
      borderLeftWidth: 4,
    },
    requestHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    bloodTitle: {
      flex: 1,
      fontSize: 20,
      marginRight: 8,
    },
    urgencyBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 16,
    },
    urgencyDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 4,
    },
    urgencyText: {
      fontSize: 12,
      fontWeight: 'bold',
    },
    timerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 12,
      backgroundColor: '#f8f8f8',
      padding: 8,
      borderRadius: 8,
    },
    timerText: {
      marginLeft: 6,
      fontSize: 13,
      fontWeight: 'bold',
    },
    actionButton: {
      marginTop: 8,
      backgroundColor: '#ff6f61',
      borderRadius: 8,
    },
    disabledButton: {
      backgroundColor: '#cccccc',
    },
    emptyCard: {
      margin: 8,
      backgroundColor: 'white',
      elevation: 2,
      borderRadius: 12,
    },
    emptyText: {
      textAlign: 'center',
      color: '#666',
      fontStyle: 'italic',
    }
  });

export default AvailableRequestsScreen;