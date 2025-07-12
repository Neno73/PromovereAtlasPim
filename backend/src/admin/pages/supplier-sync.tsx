import React, { useState, useEffect } from 'react';
import {
  Main,
  Box,
  Typography,
  Table,
  Thead,
  Tbody,
  Tr,
  Td,
  Th,
  Button,
  Badge,
  Flex,
  Tooltip,
  Loader
} from '@strapi/design-system';
import { Play, Clock, CheckCircle, Information } from '@strapi/icons';
import { useFetchClient, useNotification } from '@strapi/strapi/admin';

const SupplierSyncPage = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncingSuppliers, setSyncingSuppliers] = useState(new Set());
  const { get, post } = useFetchClient();
  const { toggleNotification } = useNotification();

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const response = await get('/content-manager/collection-types/api::supplier.supplier?pagination[pageSize]=100');
      setSuppliers(response.data.results || []);
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
      toggleNotification({
        type: 'warning',
        message: 'Failed to load suppliers',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (supplier: any) => {
    setSyncingSuppliers(prev => new Set(prev).add(supplier.id));

    try {
      const response = await post(`/api/suppliers/${supplier.id}/sync`);
      
      if (response.data.success) {
        toggleNotification({
          type: 'success',
          message: `✅ Sync completed for ${supplier.code}: ${response.data.productsProcessed} products processed (${response.data.imported} imported, ${response.data.updated} updated)`,
        });
        
        // Refresh suppliers list
        await fetchSuppliers();
      } else {
        toggleNotification({
          type: 'danger',
          message: response.data.message || 'Sync failed',
        });
      }
    } catch (error: any) {
      toggleNotification({
        type: 'danger',
        message: `❌ Sync failed for ${supplier.code}: ${error.response?.data?.error?.message || error.message}`,
      });
    } finally {
      setSyncingSuppliers(prev => {
        const newSet = new Set(prev);
        newSet.delete(supplier.id);
        return newSet;
      });
    }
  };

  const getStatusBadge = (supplier: any) => {
    const isCurrentlyLoading = syncingSuppliers.has(supplier.id);
    
    if (isCurrentlyLoading) {
      return (
        <Badge backgroundColor="secondary500" textColor="neutral0">
          🔄 Syncing...
        </Badge>
      );
    }

    const lastSync = supplier.last_sync_date;
    if (!lastSync) {
      return (
        <Badge backgroundColor="neutral150" textColor="neutral600">
          ⏸️ Never
        </Badge>
      );
    }

    return (
      <Badge backgroundColor="success500" textColor="neutral0">
        ✅ Last: {new Date(lastSync).toLocaleDateString()}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Main>
        <Box padding={8}>
          <Typography variant="alpha" tag="h1">Supplier Sync Management</Typography>
          <Box padding={8} background="neutral100" marginTop={4} hasRadius>
            <Flex direction="column" alignItems="center" gap={4}>
              <Loader />
              <Typography textAlign="center">Loading suppliers...</Typography>
            </Flex>
          </Box>
        </Box>
      </Main>
    );
  }

  return (
    <Main>
      <Box padding={8}>
        <Typography variant="alpha" tag="h1" marginBottom={2}>
          Supplier Sync Management
        </Typography>
        <Typography variant="omega" textColor="neutral600" marginBottom={6}>
          Manage individual sync operations for {suppliers.length} suppliers
        </Typography>
        
        <Box padding={6} background="neutral0" shadow="filterShadow" hasRadius>
          <Table colCount={4} rowCount={suppliers.length}>
            <Thead>
              <Tr>
                <Th>
                  <Typography variant="sigma">Supplier</Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">Code</Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">Status</Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">Actions</Typography>
                </Th>
              </Tr>
            </Thead>
            <Tbody>
              {suppliers.map((supplier: any) => (
                <Tr key={supplier.id}>
                  <Td>
                    <Typography fontWeight="semiBold">
                      {supplier.name}
                    </Typography>
                  </Td>
                  <Td>
                    <Typography variant="omega" textColor="neutral600">
                      {supplier.code}
                    </Typography>
                  </Td>
                  <Td>
                    {getStatusBadge(supplier)}
                  </Td>
                  <Td>
                    <Tooltip description={`Click to sync ${supplier.name} products`}>
                      <Button
                        onClick={() => handleSync(supplier)}
                        loading={syncingSuppliers.has(supplier.id)}
                        disabled={syncingSuppliers.has(supplier.id)}
                        variant="secondary"
                        size="S"
                        startIcon={<Play />}
                      >
                        Sync
                      </Button>
                    </Tooltip>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      </Box>
    </Main>
  );
};

export default SupplierSyncPage;
