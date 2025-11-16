import React, { useState } from 'react';
import { ResourceList, ResourceItem, Text, Button, Modal, FormLayout, TextField, Select, Banner, InlineStack, BlockStack } from '@shopify/polaris';
import { adminApi } from '../../utils/api';

export default function AdminUsersTab({ users, onRefresh }: any) {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ email: '', password: '', name: '', role: 'user' });

  const handleCreate = async () => {
    setError('');
    setLoading(true);
    try {
      await adminApi.createUser(formData);
      setShowModal(false);
      setFormData({ email: '', password: '', name: '', role: 'user' });
      await onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await adminApi.deleteUser(userId);
      await onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <>
      <div style={{ padding: '16px' }}>
        <InlineStack align="end">
          <Button variant="primary" onClick={() => setShowModal(true)}>Add User</Button>
        </InlineStack>
      </div>

      <ResourceList
        resourceName={{ singular: 'user', plural: 'users' }}
        items={users}
        renderItem={(user: any) => (
          <ResourceItem id={String(user.id)}>
            <InlineStack align="space-between">
              <BlockStack gap="100">
                <Text variant="bodyMd" fontWeight="bold" as="h3">{user.email}</Text>
                <Text variant="bodySm" as="p" tone="subdued">{user.name || 'No name'}</Text>
                <Text variant="bodySm" as="p">{user.role === 'admin' ? '👑 Admin' : '👤 User'}</Text>
              </BlockStack>
              <Button tone="critical" onClick={() => handleDelete(user.id)}>Delete</Button>
            </InlineStack>
          </ResourceItem>
        )}
      />

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add User"
        primaryAction={{ content: 'Create', onAction: handleCreate, loading }}
        secondaryActions={[{ content: 'Cancel', onAction: () => setShowModal(false) }]}>
        <Modal.Section>
          {error && <Banner tone="critical">{error}</Banner>}
          <FormLayout>
            <TextField label="Email" value={formData.email} onChange={(v) => setFormData({ ...formData, email: v })} autoComplete="off" />
            <TextField label="Password" type="password" value={formData.password} onChange={(v) => setFormData({ ...formData, password: v })} autoComplete="off" />
            <TextField label="Name" value={formData.name} onChange={(v) => setFormData({ ...formData, name: v })} autoComplete="off" />
            <Select label="Role" options={[{ label: 'User', value: 'user' }, { label: 'Admin', value: 'admin' }]} value={formData.role} onChange={(v) => setFormData({ ...formData, role: v })} />
          </FormLayout>
        </Modal.Section>
      </Modal>
    </>
  );
}
