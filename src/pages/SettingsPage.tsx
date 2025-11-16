import React, { useState, useEffect } from 'react';
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Select,
  Button,
  Banner,
  SkeletonBodyText,
} from '@shopify/polaris';
import { settingsApi } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const AI_MODELS = [
  { label: 'Claude 3.5 Sonnet (Recommended)', value: 'anthropic/claude-3.5-sonnet' },
  { label: 'Claude 3 Opus', value: 'anthropic/claude-3-opus' },
  { label: 'GPT-4 Turbo', value: 'openai/gpt-4-turbo' },
  { label: 'GPT-4', value: 'openai/gpt-4' },
];

export default function SettingsPage() {
  const { currentStore } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('anthropic/claude-3.5-sonnet');
  const [banner, setBanner] = useState<{ type: 'success' | 'critical' | 'info'; message: string } | null>(null);

  useEffect(() => {
    if (currentStore) {
      loadSettings();
    }
  }, [currentStore]);

  const loadSettings = async () => {
    if (!currentStore) return;
    try {
      const data = await settingsApi.get(currentStore.id);
      if (data.selectedModel) setSelectedModel(data.selectedModel);
      setLoading(false);
    } catch (error: any) {
      setBanner({ type: 'critical', message: error.message });
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentStore) {
      setBanner({ type: 'critical', message: 'No store selected' });
      return;
    }
    if (!apiKey) {
      setBanner({ type: 'critical', message: 'Please enter an API key' });
      return;
    }

    setSaving(true);
    try {
      await settingsApi.update(currentStore.id, apiKey, selectedModel);
      setBanner({ type: 'success', message: 'Settings saved successfully!' });
      setApiKey('');
    } catch (error: any) {
      setBanner({ type: 'critical', message: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!apiKey) {
      setBanner({ type: 'critical', message: 'Please enter an API key to test' });
      return;
    }

    setTesting(true);
    try {
      await settingsApi.testConnection(apiKey);
      setBanner({ type: 'success', message: 'Connection successful! API key is valid.' });
    } catch (error: any) {
      setBanner({ type: 'critical', message: error.message });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <Page title="Settings">
        <Layout>
          <Layout.Section>
            <Card>
              <SkeletonBodyText lines={6} />
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page
      title="Settings"
      subtitle="Configure your OpenRouter API key and AI model preferences"
    >
      <Layout>
        {banner && (
          <Layout.Section>
            <Banner
              status={banner.type}
              onDismiss={() => setBanner(null)}
            >
              {banner.message}
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card sectioned>
            <FormLayout>
              <TextField
                label="OpenRouter API Key"
                type="password"
                value={apiKey}
                onChange={setApiKey}
                placeholder="sk-or-..."
                autoComplete="off"
                helpText={
                  <span>
                    Get your API key from{' '}
                    <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer">
                      OpenRouter
                    </a>
                  </span>
                }
              />

              <Select
                label="AI Model"
                options={AI_MODELS}
                value={selectedModel}
                onChange={setSelectedModel}
                helpText="Claude 3.5 Sonnet is recommended for best mapping accuracy"
              />

              <div style={{ display: 'flex', gap: '10px' }}>
                <Button
                  onClick={handleTestConnection}
                  loading={testing}
                  disabled={!apiKey}
                >
                  Test Connection
                </Button>
                <Button
                  primary
                  onClick={handleSave}
                  loading={saving}
                  disabled={!apiKey}
                >
                  Save Settings
                </Button>
              </div>
            </FormLayout>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card title="About OpenRouter" sectioned>
            <p>
              OpenRouter provides access to multiple AI models through a single API.
              This app uses AI to automatically map your CSV columns to Shopify product fields,
              saving you time and reducing errors.
            </p>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
