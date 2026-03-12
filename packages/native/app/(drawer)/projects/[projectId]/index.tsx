import React from 'react';
import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { SessionHeader } from '../../../../components/SessionHeader';
import { useRightDrawer } from '../../../../lib/drawer-context';

/**
 * Project root route — shown when a project is selected but no session.
 * Placeholder that prompts the user to select or create a session.
 */
export default function ProjectIndexScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { openRightDrawer } = useRightDrawer();

  return (
    <View className="flex-1 bg-stone-50 dark:bg-stone-950" style={{ paddingTop: insets.top }}>
      <SessionHeader
        projectName=""
        branchName=""
        relativeTime=""
        onMenuPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        onProjectsPress={openRightDrawer}
      />
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-center text-sm text-stone-400 dark:text-stone-600">
          Select a session or start a new one
        </Text>
      </View>
    </View>
  );
}
