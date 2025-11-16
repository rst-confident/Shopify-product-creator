import React from 'react';
import { Select, Text } from '@shopify/polaris';
import { useAuth } from '../context/AuthContext';

export default function StoreSelector() {
  const { stores, currentStore, selectStore } = useAuth();

  if (stores.length === 0) {
    return (
      <div style={{ padding: '12px 16px' }}>
        <Text as="p">
          No stores available
        </Text>
      </div>
    );
  }

  const options = stores.map((store) => ({
    label: store.store_name,
    value: String(store.id),
  }));

  const handleChange = (value: string) => {
    const store = stores.find((s) => s.id === Number(value));
    if (store) {
      selectStore(store);
    }
  };

  return (
    <div style={{ padding: '12px 16px', minWidth: '250px', display: 'flex', alignItems: 'center', gap: '8px' }}>
      <Text as="span" variant="bodySm">
        Store:
      </Text>
      <div style={{ flex: 1 }}>
        <Select
          label=""
          labelHidden
          options={options}
          value={currentStore ? String(currentStore.id) : ''}
          onChange={handleChange}
        />
      </div>
    </div>
  );
}
