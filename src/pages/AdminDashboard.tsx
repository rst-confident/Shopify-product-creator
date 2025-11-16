import React, { useState, useEffect } from 'react';
import { Page, Layout, Card, Tabs, Banner, Spinner } from '@shopify/polaris';
import { adminApi } from '../utils/api';
import AdminUsersTab from '../components/admin/AdminUsersTab';
import AdminStoresTab from '../components/admin/AdminStoresTab';

export default function AdminDashboard() {
  const [selected, setSelected] = useState(0);
  const [users, setUsers] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [usersData, storesData] = await Promise.all([
        adminApi.getUsers(),
        adminApi.getAllStores(),
      ]);
      setUsers(usersData.users || []);
      setStores(storesData.stores || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  const tabs = [
    {
      id: 'users',
      content: 'Users',
      accessibilityLabel: 'Users',
      panelID: 'users-panel',
    },
    {
      id: 'stores',
      content: 'Stores',
      accessibilityLabel: 'Stores',
      panelID: 'stores-panel',
    },
  ];

  return (
    <Page title="Admin Dashboard">
      <Layout>
        <Layout.Section>
          {error && <Banner tone="critical" onDismiss={() => setError('')}>{error}</Banner>}
          
          <Card>
            <Tabs tabs={tabs} selected={selected} onSelect={setSelected}>
              {loading ? (
                <div style={{ padding: '40px', textAlign: 'center' }}>
                  <Spinner size="large" />
                </div>
              ) : (
                <>
                  {selected === 0 && <AdminUsersTab users={users} onRefresh={loadData} />}
                  {selected === 1 && <AdminStoresTab stores={stores} users={users} onRefresh={loadData} />}
                </>
              )}
            </Tabs>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
