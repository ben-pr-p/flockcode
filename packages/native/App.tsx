import React, { useState, useRef, useCallback } from 'react'
import { View, Text, Pressable, Animated } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'

import './global.css'
import { SessionContent } from './components/SessionContent'
import { SessionsSidebar } from './components/SessionsSidebar'
import { ProjectsSidebar } from './components/ProjectsSidebar'
import { SettingsScreen } from './components/SettingsScreen'
import { EmptySession } from './components/EmptySession'
import { useMusicPlayer } from './hooks/useMusicPlayer'
import { useSettings } from './hooks/useSettings'
import { useLayout } from './hooks/useLayout'

const ANIMATION_DURATION = 280

export default function App() {
  const { isTabletLandscape, width: screenWidth } = useLayout()
  const sidebarWidth = screenWidth * 0.85
  const router = useRouter()
  const params = useLocalSearchParams<{ projectId?: string; sessionId?: string }>()

  const sessionId = params.sessionId

  // Settings (only used for phone layout; iPad handles settings in left panel)
  const [settingsVisible, setSettingsVisible] = useState(false)
  const settings = useSettings()

  // Left sidebar (sessions)
  const [leftSidebarVisible, setLeftSidebarVisible] = useState(false)
  const leftSlideAnim = useRef(new Animated.Value(-sidebarWidth)).current
  const leftBackdropAnim = useRef(new Animated.Value(0)).current

  // Right sidebar (projects)
  const [rightSidebarVisible, setRightSidebarVisible] = useState(false)
  const rightSlideAnim = useRef(new Animated.Value(sidebarWidth)).current
  const rightBackdropAnim = useRef(new Animated.Value(0)).current
  const musicPlayer = useMusicPlayer()

  const openLeftSidebar = useCallback(() => {
    setLeftSidebarVisible(true)
    Animated.parallel([
      Animated.timing(leftSlideAnim, {
        toValue: 0,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(leftBackdropAnim, {
        toValue: 1,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
    ]).start()
  }, [leftSlideAnim, leftBackdropAnim])

  const closeLeftSidebar = useCallback(() => {
    Animated.parallel([
      Animated.timing(leftSlideAnim, {
        toValue: -sidebarWidth,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(leftBackdropAnim, {
        toValue: 0,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setLeftSidebarVisible(false)
    })
  }, [leftSlideAnim, leftBackdropAnim, sidebarWidth])

  const openRightSidebar = useCallback(() => {
    setRightSidebarVisible(true)
    Animated.parallel([
      Animated.timing(rightSlideAnim, {
        toValue: 0,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(rightBackdropAnim, {
        toValue: 1,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
    ]).start()
  }, [rightSlideAnim, rightBackdropAnim])

  const closeRightSidebar = useCallback(() => {
    Animated.parallel([
      Animated.timing(rightSlideAnim, {
        toValue: sidebarWidth,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(rightBackdropAnim, {
        toValue: 0,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setRightSidebarVisible(false)
    })
  }, [rightSlideAnim, rightBackdropAnim, sidebarWidth])

  const openSettings = useCallback(() => {
    closeLeftSidebar()
    setSettingsVisible(true)
  }, [closeLeftSidebar])

  const closeSettings = useCallback(() => {
    setSettingsVisible(false)
  }, [])

  const handleSelectProject = useCallback((projectId: string) => {
    router.push(`/projects/${projectId}`)
    closeRightSidebar()
  }, [router, closeRightSidebar])

  const handleSelectSession = useCallback((sessionId: string, projectId: string) => {
    router.push(`/projects/${projectId}/sessions/${sessionId}`)
    closeLeftSidebar()
  }, [router, closeLeftSidebar])

  return (
    <SafeAreaProvider>
      <View className="flex-1">
        {settingsVisible ? (
          <SettingsScreen
            serverUrl={settings.serverUrl}
            onServerUrlChange={settings.setServerUrl}
            connection={settings.connection}
            handsFreeAutoRecord={settings.handsFreeAutoRecord}
            onHandsFreeAutoRecordChange={settings.setHandsFreeAutoRecord}
            notificationSound={settings.notificationSound}
            onNotificationSoundChange={settings.setNotificationSound}
            notificationSoundOptions={settings.notificationSoundOptions}
            appVersion={settings.appVersion}
            defaultModel={settings.defaultModel}
            onBack={closeSettings}
          />
        ) : sessionId ? (
          <SessionContent
            sessionId={sessionId}
            isTabletLandscape={isTabletLandscape}
            onMenuPress={openLeftSidebar}
            onProjectsPress={openRightSidebar}
            settings={settings}
          />
        ) : (
          <EmptySession
            onMenuPress={openLeftSidebar}
            onProjectsPress={openRightSidebar}
          />
        )}

        {/* Left sidebar overlay (sessions) */}
        {leftSidebarVisible && (
          <View className="absolute inset-0" style={{ zIndex: 50 }}>
            <Animated.View
              className="absolute inset-0 bg-black"
              style={{ opacity: leftBackdropAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }) }}
            >
              <Pressable className="flex-1" onPress={closeLeftSidebar} />
            </Animated.View>
            <Animated.View
              className="absolute top-0 bottom-0 left-0"
              style={{ width: sidebarWidth, transform: [{ translateX: leftSlideAnim }] }}
            >
              <SessionsSidebar
                projectId={params.projectId}
                selectedSessionId={params.sessionId ?? null}
                onClose={closeLeftSidebar}
                onNewSession={() => {}}
                onSelectSession={handleSelectSession}
                onOverflowSession={() => {}}
                onSettingsPress={openSettings}
                onMicPress={() => {}}
                onHelpPress={() => {}}
              />
            </Animated.View>
          </View>
        )}

        {/* Right sidebar overlay (projects) */}
        {rightSidebarVisible && (
          <View className="absolute inset-0" style={{ zIndex: 50 }}>
            <Animated.View
              className="absolute inset-0 bg-black"
              style={{ opacity: rightBackdropAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }) }}
            >
              <Pressable className="flex-1" onPress={closeRightSidebar} />
            </Animated.View>
            <Animated.View
              className="absolute top-0 bottom-0 right-0"
              style={{ width: sidebarWidth, transform: [{ translateX: rightSlideAnim }] }}
            >
              <ProjectsSidebar
                selectedProjectId={params.projectId ?? null}
                onClose={closeRightSidebar}
                onAddProject={() => {}}
                onSelectProject={handleSelectProject}
                onNewSession={() => {}}
                onOverflow={() => {}}
                musicPlayer={musicPlayer}
              />
            </Animated.View>
          </View>
        )}
      </View>
      <StatusBar style="light" />
    </SafeAreaProvider>
  )
}
