import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Page,
  Card,
  Form,
  FormLayout,
  TextField,
  Button,
  Banner,
  Text,
  BlockStack,
} from '@shopify/polaris';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async () => {
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      // Redirect happens automatically via App.tsx route protection
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page>
      <div style={{ maxWidth: '500px', margin: '100px auto' }}>
        <BlockStack gap="400">
          <div style={{ textAlign: 'center' }}>
            <Text variant="headingXl" as="h1">
              Shopify Product Importer
            </Text>
            <Text variant="bodyMd" as="p" tone="subdued">
              Sign in to your account
            </Text>
          </div>

          <Card>
            <BlockStack gap="400">
              {error && (
                <Banner tone="critical" onDismiss={() => setError('')}>
                  {error}
                </Banner>
              )}

              <Form onSubmit={handleSubmit}>
                <FormLayout>
                  <TextField
                    label="Email"
                    type="email"
                    value={email}
                    onChange={setEmail}
                    autoComplete="email"
                    disabled={loading}
                    autoFocus
                  />

                  <TextField
                    label="Password"
                    type="password"
                    value={password}
                    onChange={setPassword}
                    autoComplete="current-password"
                    disabled={loading}
                  />

                  <Button
                    variant="primary"
                    fullWidth
                    loading={loading}
                    submit
                  >
                    Sign In
                  </Button>
                </FormLayout>
              </Form>

              <div style={{ textAlign: 'center', marginTop: '16px' }}>
                <Text variant="bodySm" as="p" tone="subdued">
                  Contact your administrator for access
                </Text>
              </div>
            </BlockStack>
          </Card>
        </BlockStack>
      </div>
    </Page>
  );
}
