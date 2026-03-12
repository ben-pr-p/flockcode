import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { SessionContent } from '../../../../../../components/SessionContent';
import { useRightDrawer } from '../../../../../../lib/drawer-context';
import { useSettings } from '../../../../../../hooks/useSettings';
import { useLayout } from '../../../../../../hooks/useLayout';

/**
 * Existing session route — renders the full session view.
 * Reads projectId and sessionId from URL params.
 */
export default function SessionScreen() {
  const { sessionId } = useLocalSearchParams<{
    projectId: string;
    sessionId: string;
  }>();
  const navigation = useNavigation();
  const { openRightDrawer } = useRightDrawer();
  const settings = useSettings();
  const { isTabletLandscape } = useLayout();

  if (!sessionId) return null;

  return (
    <SessionContent
      sessionId={sessionId}
      isTabletLandscape={isTabletLandscape}
      onMenuPress={() => navigation.dispatch(DrawerActions.openDrawer())}
      onProjectsPress={openRightDrawer}
      settings={settings}
    />
  );
}
