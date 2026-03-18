import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { SessionContent } from '../../../../../../components/SessionContent';
import { useRightDrawer } from '../../../../../../lib/drawer-context';
import { useSettings } from '../../../../../../hooks/useSettings';
import { useLayout } from '../../../../../../hooks/useLayout';
import type { BackendUrl } from '../../../../../../state/backends';

/**
 * Existing session route — renders the full session view.
 * Reads projectId, sessionId, and backendUrl from URL params.
 */
export default function SessionScreen() {
  const { sessionId, backendUrl } = useLocalSearchParams<{
    projectId: string;
    sessionId: string;
    backendUrl: string;
  }>();
  const navigation = useNavigation();
  const { openRightDrawer } = useRightDrawer();
  const settings = useSettings();
  const { isTabletLandscape } = useLayout();

  if (!sessionId || !backendUrl) return null;

  return (
    <SessionContent
      sessionId={sessionId}
      backendUrl={backendUrl as BackendUrl}
      isTabletLandscape={isTabletLandscape}
      onMenuPress={() => navigation.dispatch(DrawerActions.openDrawer())}
      onProjectsPress={openRightDrawer}
      settings={settings}
    />
  );
}
