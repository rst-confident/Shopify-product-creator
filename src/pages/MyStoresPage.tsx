import React, { useState } from 'react';
import {
  Page,
  Layout,
  Card,
  ResourceList,
  ResourceItem,
  Text,
  Button,
  Modal,
  FormLayout,
  TextField,
  Banner,
  Stack,
  Stack,
} from '@shopify/polaris';
import { useAuth } from '../context/AuthContext';
import { userStoresApi } from '../utils/api';

export default function MyStoresPage() {
  const { stores, refreshStores, selectStore } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    storeName: '',
    shopifyDomain: '',
    shopifyAccessToken: '',
    openrouterApiKey: '',
    selectedAiModel: 'anthropic/claude-3.5-sonnet',
  });

  const handleCreateStore = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await userStoresApi.createStore(formData);
      setSuccess('Store created successfully!');
      setShowModal(false);
      setFormData({
        storeName: '',
        shopifyDomain: '',
        shopifyAccessToken: '',
        openrouterApiKey: '',
        selectedAiModel: 'anthropic/claude-3.5-sonnet',
      });
      await refreshStores();
    } catch (err: any) {
      setError(err.message || 'Failed to create store');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectStore = (storeId: number) => {
    const store = stores.find((s) => s.id === storeId);
    if (store) {
      selectStore(store);
    }
  };

  return (
    <Page
      title="My Stores"
      primaryAction={{
        content: 'Add Store',
        onAction: () => setShowModal(true),
      }}
    >
      <Layout>
        <Layout.Section>
          {success && (
            <Banner tone="success" onDismiss={() => setSuccess('')}>
              {success}
            </Banner>
          )}

          <Card>
            {stores.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <Text as="p" variant="bodyMd">
                    You don't have any stores yet.
                  </Text>
                  <div>
                    <Button variant="primary" onClick={() => setShowModal(true)}>
                      Add Your First Store
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <ResourceList
                resourceName={{ singular: 'store', plural: 'stores' }}
                items={stores}
                renderItem={(store) => {
                  const { id, store_name, shopify_domain, created_at } = store;

                  return (
                    <ResourceItem
                      id={String(id)}
                      onClick={() => handleSelectStore(id)}
                      accessibilityLabel={`Select ${store_name}`}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                          <Text variant="bodyMd" fontWeight="bold" as="h3">
                            {store_name}
                          </Text>
                          <Text variant="bodySm" as="p" tone="subdued">
                            {shopify_domain}
                          </Text>
                          <Text variant="bodySm" as="p" tone="subdued">
                            Created: {new Date(created_at).toLocaleDateString()}
                          </Text>
                        </div>
                      </div>
                    </ResourceItem>
                  );
                }}
              />
            )}
          </Card>
        </Layout.Section>
      </Layout>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Add New Store"
        primaryAction={{
          content: 'Create Store',
          onAction: handleCreateStore,
          loading,
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setShowModal(false),
          },
        ]}
      >
        <Modal.Section>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {error && <Banner tone="critical">{error}</Banner>}

            <FormLayout>
              <TextField
                label="Store Name"
                value={formData.storeName}
                onChange={(value) => setFormData({ ...formData, storeName: value })}
                autoComplete="off"
                placeholder="My Shopify Store"
              />

              <TextField
                label="Shopify Domain"
                value={formData.shopifyDomain}
                onChange={(value) => setFormData({ ...formData, shopifyDomain: value })}
                autoComplete="off"
                placeholder="your-store.myshopify.com"
                helpText="Your Shopify store domain"
              />

              <TextField
                label="Shopify Access Token"
                value={formData.shopifyAccessToken}
                onChange={(value) => setFormData({ ...formData, shopifyAccessToken: value })}
                autoComplete="off"
                placeholder="shpat_..."
                helpText="Admin API access token from Shopify"
              />

              <TextField
                label="OpenRouter API Key (Optional)"
                value={formData.openrouterApiKey}
                onChange={(value) => setFormData({ ...formData, openrouterApiKey: value })}
                autoComplete="off"
                placeholder="sk-or-..."
                helpText="For AI-powered column mapping"
              />
            </FormLayout>
          </div>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
