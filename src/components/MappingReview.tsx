import React, { useState, useEffect } from 'react';
import {
  Page,
  Layout,
  Card,
  DataTable,
  Select,
  Button,
  Banner,
  SkeletonBodyText,
  InlineStack,
  BlockStack,
  Badge,
  ButtonGroup,
} from '@shopify/polaris';
import { mappingApi } from '../utils/api';

interface MappingReviewProps {
  headers: string[];
  sampleData: any[];
  onComplete: (mappings: any) => void;
  onBack: () => void;
}

const SHOPIFY_FIELDS = [
  { label: 'Title', value: 'title' },
  { label: 'Price', value: 'price' },
  { label: 'EAN', value: 'ean' },
  { label: 'SKU', value: 'sku' },
  { label: 'Color', value: 'color' },
  { label: 'Image URL 1', value: 'image_url_1' },
  { label: 'Image URL 2', value: 'image_url_2' },
  { label: 'Image URL 3', value: 'image_url_3' },
  { label: 'Description - Fabric', value: 'description_fabric' },
  { label: 'Description - Quality', value: 'description_quality' },
  { label: 'Description - Fit', value: 'description_fit' },
  { label: 'Description - Care', value: 'description_care' },
  { label: 'Description - Material', value: 'description_material' },
  { label: 'Description - Style', value: 'description_style' },
  { label: 'Description - Generic', value: 'description_generic' },
  { label: 'Ignore', value: 'ignore' },
];

export default function MappingReview({
  headers,
  sampleData,
  onComplete,
  onBack,
}: MappingReviewProps) {
  const [loading, setLoading] = useState(true);
  const [mappings, setMappings] = useState<Record<string, { shopifyField: string; confidence: number }>>({});
  const [banner, setBanner] = useState<{ type: 'success' | 'critical' | 'info'; message: string } | null>(null);

  useEffect(() => {
    loadAISuggestions();
  }, []);

  const loadAISuggestions = async () => {
    setLoading(true);
    try {
      const data = await mappingApi.getAISuggestions(headers, sampleData);
      setMappings(data.mappings);
      setBanner({
        type: 'info',
        message: 'AI suggestions loaded. Please review and adjust if needed.',
      });
    } catch (error: any) {
      setBanner({
        type: 'critical',
        message: `Failed to get AI suggestions: ${error.message}. Please map manually.`,
      });
      // Initialize with empty mappings
      const emptyMappings: any = {};
      headers.forEach((header) => {
        emptyMappings[header] = { shopifyField: 'ignore', confidence: 0 };
      });
      setMappings(emptyMappings);
    } finally {
      setLoading(false);
    }
  };

  const handleMappingChange = (csvColumn: string, shopifyField: string) => {
    setMappings({
      ...mappings,
      [csvColumn]: {
        shopifyField,
        confidence: mappings[csvColumn]?.confidence || 1,
      },
    });
  };

  const handleConfirm = () => {
    // Validate that at least title and price are mapped
    const hasTitle = Object.values(mappings).some((m) => m.shopifyField === 'title');
    const hasPrice = Object.values(mappings).some((m) => m.shopifyField === 'price');

    if (!hasTitle) {
      setBanner({ type: 'critical', message: 'Please map at least one column to "Title"' });
      return;
    }

    if (!hasPrice) {
      setBanner({ type: 'critical', message: 'Please map at least one column to "Price"' });
      return;
    }

    onComplete(mappings);
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) return <Badge status="success">High</Badge>;
    if (confidence >= 0.5) return <Badge status="warning">Medium</Badge>;
    return <Badge status="critical">Low</Badge>;
  };

  const rows = headers.map((header) => {
    const mapping = mappings[header];
    const sampleValues = sampleData
      .map((row) => row[header])
      .filter(Boolean)
      .slice(0, 3)
      .join(', ');

    return [
      header,
      sampleValues || '(empty)',
      mapping ? getConfidenceBadge(mapping.confidence) : '-',
      <Select
        label=""
        labelHidden
        options={SHOPIFY_FIELDS}
        value={mapping?.shopifyField || 'ignore'}
        onChange={(value) => handleMappingChange(header, value)}
      />,
    ];
  });

  if (loading) {
    return (
      <Page title="Column Mapping">
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

  return (
    <Page
      title="Review Column Mapping"
      subtitle="Review AI-suggested mappings and adjust as needed"
      backAction={{ content: 'Back', onAction: onBack }}
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
            <DataTable
              columnContentTypes={['text', 'text', 'text', 'text']}
              headings={['CSV Column', 'Sample Values', 'AI Confidence', 'Map To Shopify Field']}
              rows={rows}
            />
            <div style={{ padding: '16px', borderTop: '1px solid #e1e3e5', display: 'flex', justifyContent: 'flex-end' }}>
              <ButtonGroup>
                <Button onClick={onBack}>Back</Button>
                <Button primary onClick={handleConfirm}>
                  Confirm & Process
                </Button>
              </ButtonGroup>
            </div>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card title="Mapping Tips" sectioned>
            <BlockStack gap="200">
              <p><strong>Required fields:</strong> Title and Price must be mapped.</p>
              <p><strong>Color variants:</strong> Map the color column to combine products as variants.</p>
              <p><strong>Images:</strong> Map up to 3 image URL columns.</p>
              <p><strong>Descriptions:</strong> Multiple description fields will be combined automatically.</p>
              <p><strong>Ignore:</strong> Columns marked as "Ignore" will not be imported.</p>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
