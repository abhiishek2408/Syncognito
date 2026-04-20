import React, { useState, useEffect } from 'react';
import { Text, StyleSheet, TextStyle } from 'react-native';

export const getTimeLeftString = (triggerAt: string) => {
  const trigger = new Date(triggerAt);
  const now = new Date();
  const diff = trigger.getTime() - now.getTime();
  if (diff <= 0) return 'Triggering...';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h left`;
  }
  
  if (hours > 0) return `${hours}h ${minutes}m left`;
  if (minutes > 0) return `${minutes}m ${seconds}s left`;
  return `${seconds}s left`;
};

interface Props {
  triggerAt: string;
  isPast: boolean;
  color: string;
  style?: TextStyle;
}

export const AlarmCountdown = ({ triggerAt, isPast, color, style }: Props) => {
  const [timeLeft, setTimeLeft] = useState(getTimeLeftString(triggerAt));

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(getTimeLeftString(triggerAt));
    }, 1000);
    return () => clearInterval(timer);
  }, [triggerAt]);

  return (
    <Text style={[styles.default, { color: '#FFF' }, style]}>
       {isPast ? 'EXPIRED' : timeLeft}
    </Text>
  );
};

const styles = StyleSheet.create({
  default: {
    fontSize: 11,
    fontWeight: '700',
  }
});
