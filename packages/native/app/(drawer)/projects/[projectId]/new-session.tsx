import React, { useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { NewSessionContent } from '../../../../components/SessionContent';
import { useRightDrawer } from '../../../../lib/drawer-context';
import { useSettings } from '../../../../hooks/useSettings';
import { useLayout } from '../../../../hooks/useLayout';

/**
 * New session route — renders the new-session view for a project.
 * Navigates to the real session route once the session is created on the server.
 */
export default function NewSessionScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { openRightDrawer } = useRightDrawer();
  const settings = useSettings();
  const { isTabletLandscape } = useLayout();

  const handleSessionCreated = useCallback(
    (newSessionId: string, pid: string) => {
      router.replace({
        pathname: '/projects/[projectId]/sessions/[sessionId]',
        params: { projectId: pid, sessionId: newSessionId },
      });
    },
    [router],
  );

  if (!projectId) return null;

  return (
    <NewSessionContent
      projectId={projectId}
      isTabletLandscape={isTabletLandscape}
      onMenuPress={() => navigation.dispatch(DrawerActions.openDrawer())}
      onProjectsPress={openRightDrawer}
      onSessionCreated={handleSessionCreated}
      settings={settings}
    />
  );
}
