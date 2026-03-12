import React, { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { SettingsScreen } from '../components/SettingsScreen';
import { ModelSelectorSheet } from '../components/ModelSelectorSheet';
import { useSettings } from '../hooks/useSettings';
import { useModels } from '../hooks/useModels';

/**
 * Settings modal route — presented as a modal overlay via expo-router.
 * Accessible from the sessions sidebar gear icon.
 */
export default function SettingsModal() {
  const router = useRouter();
  const settings = useSettings();
  const { selectedModel, setSelectedModel, catalog, getDisplayNames, getDefaultModel, refetchCatalog } = useModels();
  const [modelSelectorVisible, setModelSelectorVisible] = useState(false);

  // Compute the display name for the selected model
  const defaultModelDisplay = useMemo(() => {
    if (selectedModel) {
      const { modelName, providerName } = getDisplayNames(selectedModel.modelID, selectedModel.providerID);
      return providerName ? `${providerName} / ${modelName}` : modelName;
    }
    const dm = getDefaultModel();
    if (dm) {
      const { modelName, providerName } = getDisplayNames(dm.modelID, dm.providerID);
      return providerName ? `${providerName} / ${modelName}` : modelName;
    }
    return settings.defaultModel;
  }, [selectedModel, getDisplayNames, getDefaultModel, settings.defaultModel]);

  return (
    <>
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
        defaultModel={defaultModelDisplay}
        onDefaultModelPress={() => setModelSelectorVisible(true)}
        onResyncConfig={refetchCatalog}
        onBack={() => router.back()}
      />
      <ModelSelectorSheet
        visible={modelSelectorVisible}
        onClose={() => setModelSelectorVisible(false)}
        catalog={catalog}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
        defaultModel={getDefaultModel()}
      />
    </>
  );
}
