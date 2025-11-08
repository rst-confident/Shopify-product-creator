import React, { useState } from 'react';
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  DropZone,
  Button,
  Banner,
  Text,
  Stack,
  Badge,
} from '@shopify/polaris';
import { uploadApi, mappingApi, processApi } from '../utils/api';
import MappingReview from '../components/MappingReview';

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [supplierName, setSupplierName] = useState('');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'critical' | 'info'; message: string } | null>(null);

  // Upload response data
  const [uploadData, setUploadData] = useState<any>(null);
  const [mappingStage, setMappingStage] = useState<'upload' | 'mapping' | 'processing' | 'complete'>('upload');

  const handleFileDrop = (files: File[]) => {
    if (files.length > 0) {
      setFile(files[0]);
      setBanner(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setBanner({ type: 'critical', message: 'Please select a CSV file' });
      return;
    }

    if (!supplierName.trim()) {
      setBanner({ type: 'critical', message: 'Please enter a supplier name' });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('supplierName', supplierName);
      formData.append('notes', notes);

      const data = await uploadApi.uploadFile(formData);
      setUploadData(data);
      setMappingStage('mapping');
      setBanner({ type: 'success', message: `File uploaded successfully! ${data.rowCount} products found.` });
    } catch (error: any) {
      setBanner({ type: 'critical', message: error.message });
    } finally {
      setUploading(false);
    }
  };

  const handleMappingComplete = async (mappings: any) => {
    setMappingStage('processing');

    try {
      // Save mapping and process products
      await mappingApi.saveMapping(uploadData.fileId, mappings);

      const result = await processApi.processProducts(
        uploadData.fileId,
        mappings,
        uploadData.records,
        supplierName
      );

      setBanner({
        type: 'success',
        message: `Processing complete! ${result.summary.productsReady} products ready to import. ${result.summary.duplicatesSkipped} duplicates skipped.`,
      });
      setMappingStage('complete');

      // Reset form
      setTimeout(() => {
        setFile(null);
        setSupplierName('');
        setNotes('');
        setUploadData(null);
        setMappingStage('upload');
      }, 3000);
    } catch (error: any) {
      setBanner({ type: 'critical', message: error.message });
      setMappingStage('mapping');
    }
  };

  const handleBackToUpload = () => {
    setMappingStage('upload');
    setUploadData(null);
    setBanner(null);
  };

  if (mappingStage === 'mapping' && uploadData) {
    return (
      <MappingReview
        headers={uploadData.headers}
        sampleData={uploadData.sampleData}
        onComplete={handleMappingComplete}
        onBack={handleBackToUpload}
      />
    );
  }

  return (
    <Page
      title="Upload CSV"
      subtitle="Upload a CSV file to import products to Shopify"
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
          <Card sectioned>
            <FormLayout>
              <DropZone
                accept=".csv"
                type="file"
                onDrop={handleFileDrop}
                disabled={uploading || mappingStage !== 'upload'}
              >
                {file ? (
                  <Stack vertical spacing="tight">
                    <Text variant="bodyMd" as="p">
                      {file.name}
                    </Text>
                    <Badge status="success">Ready to upload</Badge>
                  </Stack>
                ) : (
                  <DropZone.FileUpload actionHint="Accepts .csv files" />
                )}
              </DropZone>

              <TextField
                label="Supplier Name"
                value={supplierName}
                onChange={setSupplierName}
                placeholder="Enter supplier name"
                autoComplete="off"
                disabled={uploading || mappingStage !== 'upload'}
                requiredIndicator
              />

              <TextField
                label="Notes (Optional)"
                value={notes}
                onChange={setNotes}
                placeholder="Add any notes about this upload"
                multiline={3}
                autoComplete="off"
                disabled={uploading || mappingStage !== 'upload'}
              />

              <Button
                primary
                onClick={handleUpload}
                loading={uploading}
                disabled={!file || !supplierName.trim() || mappingStage !== 'upload'}
              >
                Process File
              </Button>
            </FormLayout>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card title="How it works" sectioned>
            <Stack vertical spacing="tight">
              <Text variant="bodyMd" as="p">
                1. Upload your CSV file containing product data
              </Text>
              <Text variant="bodyMd" as="p">
                2. AI will automatically suggest field mappings
              </Text>
              <Text variant="bodyMd" as="p">
                3. Review and adjust mappings if needed
              </Text>
              <Text variant="bodyMd" as="p">
                4. Products are processed and added to the queue
              </Text>
              <Text variant="bodyMd" as="p">
                5. Import selected products to Shopify
              </Text>
            </Stack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
