/**
 * BackendSelectorSheet — a bottom-sheet picker for choosing which backend
 * server to create a new session on.
 *
 * Shows connected backends as selectable options and offline backends
 * (that host the project but aren't currently connected) as disabled rows.
 *
 * Mirrors the visual style and animation pattern of ModelSelectorSheet.
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  Animated,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { Check, Monitor, Cloud } from 'lucide-react-native';
import type {
  BackendUrl,
  BackendConfig,
  BackendConnection,
  BackendStatus,
} from '../state/backends';

/** A backend option shown in the selector. */
export interface BackendOption {
  config: BackendConfig;
  connection: BackendConnection | undefined;
  /** Whether this backend has the project in its StateDB. */
  hasProject: boolean;
}

interface BackendSelectorSheetProps {
  visible: boolean;
  onClose: () => void;
  options: BackendOption[];
  selectedUrl: BackendUrl;
  onSelect: (url: BackendUrl) => void;
}

export function BackendSelectorSheet({
  visible,
  onClose,
  options,
  selectedUrl,
  onSelect,
}: BackendSelectorSheetProps) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const slideAnim = useRef(new Animated.Value(0)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      slideAnim.setValue(0);
      backdropAnim.setValue(0);
    }
  }, [visible, slideAnim, backdropAnim]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  };

  const handleSelect = (url: BackendUrl) => {
    onSelect(url);
    handleClose();
  };

  const screenHeight = Dimensions.get('window').height;
  const sheetMaxHeight = screenHeight * 0.5;

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [sheetMaxHeight, 0],
  });

  // Split into connected (selectable) and offline (disabled) groups
  const connected = options.filter(
    (o) => o.connection?.status === 'connected',
  );
  const offline = options.filter(
    (o) => o.connection?.status !== 'connected',
  );

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={handleClose}
    >
      {/* Backdrop */}
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          opacity: backdropAnim,
          justifyContent: 'flex-end',
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={handleClose} />

        {/* Sheet */}
        <Animated.View
          style={{
            transform: [{ translateY }],
            maxHeight: sheetMaxHeight,
            backgroundColor: isDark ? '#1C1917' : '#FAFAF9',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            paddingBottom: insets.bottom + 8,
          }}
        >
          {/* Handle bar */}
          <View className="items-center pt-3 pb-2">
            <View
              className="h-1 w-9 rounded-full"
              style={{ backgroundColor: isDark ? '#44403C' : '#D6D3D1' }}
            />
          </View>

          {/* Header */}
          <View className="px-5 pb-3">
            <Text
              className="text-base font-semibold text-stone-900 dark:text-stone-50"
              style={{ fontFamily: 'JetBrains Mono' }}
            >
              Select Server
            </Text>
          </View>

          <ScrollView
            className="px-5"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Connected backends */}
            {connected.length > 0 && (
              <>
                <SectionLabel text="CONNECTED" />
                {connected.map((opt) => (
                  <BackendRow
                    key={opt.config.url}
                    option={opt}
                    isSelected={selectedUrl === opt.config.url}
                    onPress={() => handleSelect(opt.config.url)}
                    isDark={isDark}
                    disabled={false}
                  />
                ))}
              </>
            )}

            {/* Offline backends */}
            {offline.length > 0 && (
              <>
                {connected.length > 0 && (
                  <View className="my-2 h-px bg-stone-200 dark:bg-stone-800" />
                )}
                <SectionLabel text="OFFLINE" />
                {offline.map((opt) => (
                  <BackendRow
                    key={opt.config.url}
                    option={opt}
                    isSelected={false}
                    onPress={() => {}}
                    isDark={isDark}
                    disabled
                  />
                ))}
              </>
            )}

            {/* Empty state */}
            {options.length === 0 && (
              <View className="items-center py-8">
                <Text
                  className="text-center text-sm text-stone-400 dark:text-stone-600"
                  style={{ fontFamily: 'JetBrains Mono' }}
                >
                  No servers host this project
                </Text>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionLabel({ text }: { text: string }) {
  return (
    <Text
      className="mb-2 px-1 text-[10px] font-semibold text-stone-400 dark:text-stone-600"
      style={{ letterSpacing: 2, fontFamily: 'JetBrains Mono' }}
    >
      {text}
    </Text>
  );
}

function statusLabel(connection: BackendConnection | undefined): string {
  const status: BackendStatus | undefined = connection?.status;
  if (status === 'connected') {
    const ms = connection?.latencyMs;
    return ms != null ? `Connected · ${ms}ms` : 'Connected';
  }
  if (status === 'reconnecting') return 'Connecting...';
  if (status === 'error') return connection?.error ?? 'Connection failed';
  return 'Offline';
}

function statusDotClass(connection: BackendConnection | undefined): string {
  const status: BackendStatus | undefined = connection?.status;
  if (status === 'connected') return 'bg-green-500';
  if (status === 'reconnecting') return 'bg-amber-500';
  if (status === 'error') return 'bg-red-500';
  return 'bg-stone-400 dark:bg-stone-600';
}

function BackendRow({
  option,
  isSelected,
  onPress,
  isDark,
  disabled,
}: {
  option: BackendOption;
  isSelected: boolean;
  onPress: () => void;
  isDark: boolean;
  disabled: boolean;
}) {
  const { config, connection } = option;
  const Icon = config.type === 'local' ? Monitor : Cloud;
  const iconColor = disabled
    ? isDark
      ? '#57534E'
      : '#A8A29E'
    : isDark
      ? '#A8A29E'
      : '#44403C';

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      className="mb-0.5 flex-row items-center rounded-lg px-3 py-2.5"
      style={{
        backgroundColor: isSelected
          ? isDark
            ? '#292524'
            : '#F5F5F4'
          : 'transparent',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Icon size={16} color={iconColor} style={{ marginRight: 10 }} />
      <View className="mr-3 flex-1">
        <Text
          className="text-sm text-stone-900 dark:text-stone-50"
          style={{ fontFamily: 'JetBrains Mono' }}
        >
          {config.name || 'Unnamed'}
        </Text>
        <View className="mt-0.5 flex-row items-center gap-1.5">
          <View className={`h-1.5 w-1.5 rounded-full ${statusDotClass(connection)}`} />
          <Text
            className="text-[10px] text-stone-500 dark:text-stone-500"
            style={{ fontFamily: 'JetBrains Mono' }}
          >
            {statusLabel(connection)}
          </Text>
        </View>
      </View>
      {isSelected && (
        <Check size={16} color={isDark ? '#F59E0B' : '#D97706'} />
      )}
    </Pressable>
  );
}
