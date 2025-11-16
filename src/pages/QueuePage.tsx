import React, { useState, useEffect } from 'react';
import {
  Page,
  Layout,
  Card,
  ResourceList,
  ResourceItem,
  Thumbnail,
  Text,
  Button,
  Banner,
  EmptyState,
  SkeletonBodyText,
  Stack,
  Stack,
  Badge,
  Modal,
  TextContainer,
  ButtonGroup,
} from '@shopify/polaris';
import { ImageIcon } from '@shopify/polaris-icons';
import { queueApi, importApi } from '../utils/api';
import { useAuth } from '../context/AuthContext';

interface Product {
  id: number;
  title: string;
  price: number;
  ean: string;
  sku: string;
  color: string;
  imageUrls: string[];
  supplierName: string;
  status: string;
}

export default function QueuePage() {
  const { currentStore } = useAuth();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
  const [banner, setBanner] = useState<{ type: 'success' | 'critical' | 'info'; message: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  useEffect(() => {
    if (currentStore) {
      loadProducts();
    }
  }, [currentStore]);

  const loadProducts = async () => {
    if (!currentStore) return;

    setLoading(true);
    try {
      const data = await queueApi.getProducts(currentStore.id);
      setProducts(data.products);
    } catch (error: any) {
      setBanner({ type: 'critical', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedProducts.length === products.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(products.map((p) => p.id));
    }
  };

  const handleImport = async () => {
    if (selectedProducts.length === 0) {
      setBanner({ type: 'critical', message: 'Please select products to import' });
      return;
    }

    if (!currentStore) {
      setBanner({ type: 'critical', message: 'No store selected' });
      return;
    }

    setImporting(true);
    try {
      const result = await importApi.importProducts(currentStore.id, selectedProducts, 'draft');
      setBanner({
        type: 'success',
        message: `Successfully imported ${result.summary.successful} products! ${result.summary.failed > 0 ? `${result.summary.failed} failed.` : ''}`,
      });
      setSelectedProducts([]);
      setShowImportModal(false);
      loadProducts();
    } catch (error: any) {
      setBanner({ type: 'critical', message: error.message });
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async () => {
    if (selectedProducts.length === 0) {
      setBanner({ type: 'critical', message: 'Please select products to delete' });
      return;
    }

    if (!currentStore) {
      setBanner({ type: 'critical', message: 'No store selected' });
      return;
    }

    setDeleting(true);
    try {
      await queueApi.deleteProducts(currentStore.id, selectedProducts);
      setBanner({
        type: 'success',
        message: `Successfully deleted ${selectedProducts.length} products`,
      });
      setSelectedProducts([]);
      loadProducts();
    } catch (error: any) {
      setBanner({ type: 'critical', message: error.message });
    } finally {
      setDeleting(false);
    }
  };

  const promotedBulkActions = [
    {
      content: 'Import Selected',
      onAction: () => setShowImportModal(true),
      disabled: selectedProducts.length === 0,
    },
    {
      content: 'Delete Selected',
      onAction: handleDelete,
      disabled: selectedProducts.length === 0,
      destructive: true,
    },
  ];

  if (loading) {
    return (
      <Page title="Products Queue">
        <Layout>
          <Layout.Section>
            <Card>
              <SkeletonBodyText lines={10} />
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  if (products.length === 0) {
    return (
      <Page title="Products Queue">
        <Layout>
          <Layout.Section>
            <Card sectioned>
              <EmptyState
                heading="No products in queue"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Upload a CSV file to add products to the queue.</p>
              </EmptyState>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page
      title="Products Queue"
      subtitle={`${products.length} products ready to import`}
      primaryAction={{
        content: 'Select All',
        onAction: handleSelectAll,
      }}
    >
      <Layout>
        {banner && (
          <Layout.Section>
            <Banner status={banner.type} onDismiss={() => setBanner(null)}>
              {banner.message}
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <ResourceList
              resourceName={{ singular: 'product', plural: 'products' }}
              items={products}
              selectedItems={selectedProducts}
              onSelectionChange={setSelectedProducts}
              promotedBulkActions={promotedBulkActions}
              selectable
              renderItem={(item) => {
                const { id, title, price, imageUrls, supplierName, sku, color } = item;
                const media = imageUrls && imageUrls.length > 0 ? (
                  <Thumbnail source={imageUrls[0]} alt={title} size="large" />
                ) : (
                  <Thumbnail source={ImageIcon} alt={title} size="large" />
                );

                return (
                  <ResourceItem
                    id={id.toString()}
                    media={media}
                    accessibilityLabel={`View details for ${title}`}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                      <Text variant="bodyMd" fontWeight="bold" as="h3">
                        {title}
                      </Text>
                      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                        <Badge>{supplierName}</Badge>
                        {color && <Badge status="info">{color}</Badge>}
                        <Text variant="bodyMd" as="span">
                          ${price.toFixed(2)}
                        </Text>
                        <Text variant="bodyMd" as="span" color="subdued">
                          SKU: {sku}
                        </Text>
                      </div>
                    </div>
                  </ResourceItem>
                );
              }}
            />
          </Card>
        </Layout.Section>
      </Layout>

      <Modal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="Import Products to Shopify"
        primaryAction={{
          content: 'Import as Draft',
          onAction: handleImport,
          loading: importing,
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setShowImportModal(false),
          },
        ]}
      >
        <Modal.Section>
          <TextContainer>
            <p>
              You are about to import <strong>{selectedProducts.length}</strong> products to Shopify.
            </p>
            <p>Products will be created as <strong>drafts</strong> and will not be visible to customers until you publish them.</p>
          </TextContainer>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
