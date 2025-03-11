import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import moment from 'moment';

const CountdownTimer = ({ createdAt, duration, color }) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      const endTime = moment(createdAt).add(duration, 'milliseconds');
      const remaining = moment.duration(endTime.diff(moment()));
      
      if (remaining.asMilliseconds() <= 0) {
        setTimeLeft('Expired');
        setIsExpired(true);
        clearInterval(timer);
        return;
      }

      const hours = Math.floor(remaining.asHours());
      const minutes = remaining.minutes();
      const seconds = remaining.seconds();

      setTimeLeft(`${hours > 0 ? `${hours}h ` : ''}${minutes}m ${seconds}s`);
    }, 1000);

    return () => clearInterval(timer);
  }, [createdAt, duration]);

  return (
    <View style={styles.timerContainer}>
      <Icon name="clock-outline" size={16} color={color} />
      <Text style={[
        styles.timerText, 
        { color: isExpired ? '#F44336' : color }
      ]}>
        {timeLeft}
      </Text>
    </View>
  );
};

const styles = {
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
  }
};

export default CountdownTimer;