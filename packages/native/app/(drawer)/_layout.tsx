import React from 'react';
import { Drawer } from 'expo-router/drawer';
import { useGlobalSearchParams } from 'expo-router';
import { SessionsSidebar } from '../../components/SessionsSidebar';
import { useLayout } from '../../hooks/useLayout';

export default function DrawerLayout() {
  const { width: screenWidth } = useLayout();
  const sidebarWidth = screenWidth * 0.85;
  // useGlobalSearchParams reads params from the currently focused child route,
  // which is necessary since this layout is a parent of the routes that define
  // the projectId/sessionId segments.
  const params = useGlobalSearchParams<{ projectId?: string; sessionId?: string }>();

  return (
    <Drawer
      screenOptions={{
        headerShown: false,
        drawerPosition: 'left',
        drawerType: 'front',
        drawerStyle: { width: sidebarWidth },
        swipeEdgeWidth: 40,
        swipeMinDistance: 50,
      }}
      drawerContent={(props) => (
        <SessionsSidebar
          projectId={params.projectId}
          selectedSessionId={params.sessionId ?? null}
          drawerNavigation={props.navigation}
        />
      )}
    />
  );
}
