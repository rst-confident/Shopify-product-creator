import React, { useState } from 'react';
import { ResourceList, ResourceItem, Text, Button, Modal, FormLayout, TextField, Select, Banner, InlineStack, BlockStack } from '@shopify/polaris';
import { adminApi } from '../../utils/api';

export default function AdminStoresTab({ stores, users, onRefresh }: any) {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ userId: '', storeName: '', shopifyDomain: '', shopifyAccessToken: '', openrouterApiKey: '' });

  const handleCreate = async () => {
    setError('');
    setLoading(true);
    try {
      await adminApi.createStore({ ...formData, userId: Number(formData.userId) });
      setShowModal(false);
      setFormData({ userId: '', storeName: '', shopifyDomain: '', shopifyAccessToken: '', openrouterApiKey: '' });
      await onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (storeId: number) => {
    if (!confirm('Are you sure you want to delete this store?')) return;
    try {
      await adminApi.deleteStore(storeId);
      await onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const userOptions = users.map((u: any) => ({ label: `${u.email} (${u.name || 'No name'})`, value: String(u.id) }));

  return (
    <>
      <div style={{ padding: '16px' }}>
        <InlineStack align="end">
          <Button variant="primary" onClick={() => setShowModal(true)}>Add Store</Button>
        </InlineStack>
      </div>

      <ResourceList
        resourceName={{ singular: 'store', plural: 'stores' }}
        items={stores}
        renderItem={(store: any) => (
          <ResourceItem id={String(store.id)}>
            <InlineStack align="space-between">
              <BlockStack gap="100">
                <Text variant="bodyMd" fontWeight="bold" as="h3">{store.store_name}</Text>
                <Text variant="bodySm" as="p" tone="subdued">{store.shopify_domain}</Text>
                <Text variant="bodySm" as="p" tone="subdued">Owner: {store.user_email}</Text>
              </BlockStack>
              <Button tone="critical" onClick={() => handleDelete(store.id)}>Delete</Button>
            </InlineStack>
          </ResourceItem>
        )}
      />

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Store"
        primaryAction={{ content: 'Create', onAction: handleCreate, loading }}
        secondaryActions={[{ content: 'Cancel', onAction: () => setShowModal(false) }]}>
        <Modal.Section>
          {error && <Banner tone="critical">{error}</Banner>}
          <FormLayout>
            <Select label="User" options={userOptions} value={formData.userId} onChange={(v) => setFormData({ ...formData, userId: v })} />
            <TextField label="Store Name" value={formData.storeName} onChange={(v) => setFormData({ ...formData, storeName: v })} autoComplete="off" />
            <TextField label="Shopify Domain" value={formData.shopifyDomain} onChange={(v) => setFormData({ ...formData, shopifyDomain: v })} autoComplete="off" />
            <TextField label="Access Token" value={formData.shopifyAccessToken} onChange={(v) => setFormData({ ...formData, shopifyAccessToken: v })} autoComplete="off" />
            <TextField label="OpenRouter API Key (Optional)" value={formData.openrouterApiKey} onChange={(v) => setFormData({ ...formData, openrouterApiKey: v })} autoComplete="off" />
          </FormLayout>
        </Modal.Section>
      </Modal>
    </>
  );
}
