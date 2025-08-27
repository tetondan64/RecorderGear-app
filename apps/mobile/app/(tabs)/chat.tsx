import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/hooks/useTheme';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: string;
}

export default function ChatScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Hello! I\'m your AI assistant. How can I help you with your recordings today?',
      isUser: false,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const handleSend = () => {
    if (inputText.trim()) {
      const userMessage: Message = {
        id: Date.now().toString(),
        text: inputText.trim(),
        isUser: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, userMessage]);
      setInputText('');

      // Simulate AI response
      setTimeout(() => {
        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          text: 'Thanks for your message! Full AI chat functionality will be implemented in Phase P1. For now, this is a demo interface.',
          isUser: false,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages(prev => [...prev, aiResponse]);
      }, 1000);
    }
  };

  const MessageBubble = ({ message }: { message: Message }) => {
    const bubbleStyle = [
      styles.messageBubble,
      message.isUser ? styles.userBubble : styles.aiBubble,
      {
        backgroundColor: message.isUser ? theme.colors.primary : theme.colors.surface,
        alignSelf: message.isUser ? 'flex-end' as const : 'flex-start' as const,
      },
    ];

    const textStyle = [
      styles.messageText,
      {
        color: message.isUser ? theme.colors.surface : theme.colors.text,
      },
    ];

    return (
      <View style={bubbleStyle}>
        <Text style={textStyle}>{message.text}</Text>
        <Text style={[
          styles.timestamp,
          { color: message.isUser ? theme.colors.surface : theme.colors.textSecondary },
        ]}>
          {message.timestamp}
        </Text>
      </View>
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      paddingTop: insets.top, // Use safe area insets
    },
    header: {
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.md, // Reduced since we handle safe area in container
      paddingBottom: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    title: {
      fontSize: theme.typography.sizes.xxxl,
      fontWeight: theme.typography.weights.bold,
      color: theme.colors.text,
      textAlign: 'center',
    },
    messagesContainer: {
      flex: 1,
      paddingHorizontal: theme.spacing.md,
    },
    messageBubble: {
      maxWidth: '80%',
      borderRadius: 16,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      marginVertical: theme.spacing.xs,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 1,
    },
    userBubble: {
      borderBottomRightRadius: 4,
    },
    aiBubble: {
      borderBottomLeftRadius: 4,
    },
    messageText: {
      fontSize: theme.typography.sizes.md,
      lineHeight: theme.typography.lineHeights.normal * theme.typography.sizes.md,
    },
    timestamp: {
      fontSize: theme.typography.sizes.xs,
      marginTop: theme.spacing.xs,
      opacity: 0.7,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 20,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      marginRight: theme.spacing.sm,
      maxHeight: 100,
      fontSize: theme.typography.sizes.md,
      color: theme.colors.text,
      backgroundColor: theme.colors.background,
    },
    sendButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: 20,
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.lg,
    },
    emptyText: {
      fontSize: theme.typography.sizes.lg,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginTop: theme.spacing.md,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>AI Chat</Text>
      </View>

      <ScrollView
        style={styles.messagesContainer}
        contentContainerStyle={{ paddingVertical: theme.spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        {messages.map(message => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Ask about your recordings..."
          placeholderTextColor={theme.colors.textSecondary}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={styles.sendButton}
          onPress={handleSend}
          disabled={!inputText.trim()}
        >
          <Ionicons
            name="send"
            size={20}
            color={theme.colors.surface}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}
