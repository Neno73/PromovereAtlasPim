import React, { useState, useEffect, useCallback } from "react";
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
  Loader,
} from "@strapi/design-system";
import { Play, Clock, CheckCircle, Information, Download, Database, Cross } from "@strapi/icons";
import { useFetchClient, useNotification } from "@strapi/strapi/admin";

// Types for sync status
interface SyncStatus {
  isRunning: boolean;
  stopRequested: boolean;
  lockInfo?: {
    lockedAt: string;
    syncId: string;
  };
}

interface ActiveSyncs {
  promidata: Array<{ supplierId: string; lockInfo: any }>;
  gemini: Array<{ supplierCode: string; lockInfo: any }>;
}

const SupplierSyncPage = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncingSuppliers, setSyncingSuppliers] = useState(new Set<string>());
  const [stoppingSyncSuppliers, setStoppingSyncSuppliers] = useState(new Set<string>());
  const [exportingSuppliers, setExportingSuppliers] = useState(new Set());
  const [geminiSyncingSuppliers, setGeminiSyncingSuppliers] = useState(new Set<string>());
  const [stoppingGeminiSuppliers, setStoppingGeminiSuppliers] = useState(new Set<string>());
  const { get, post } = useFetchClient();
  const { toggleNotification } = useNotification();

  // Poll interval for checking sync status
  const POLL_INTERVAL = 5000; // 5 seconds

  // Fetch active syncs from API
  const fetchActiveSyncs = useCallback(async () => {
    try {
      const response = await fetch('/api/promidata-sync/active');
      const data = await response.json();

      if (data.success) {
        const activeSyncs: ActiveSyncs = data.data;

        // Update promidata syncing suppliers
        const promidataIds = new Set(activeSyncs.promidata.map(s => s.supplierId));
        setSyncingSuppliers(promidataIds);

        // Update gemini syncing suppliers
        const geminiCodes = new Set(activeSyncs.gemini.map(s => s.supplierCode));
        setGeminiSyncingSuppliers(geminiCodes);
      }
    } catch (error) {
      console.error("Failed to fetch active syncs:", error);
    }
  }, []);

  useEffect(() => {
    fetchSuppliers();
    fetchActiveSyncs();

    // Poll for sync status updates
    const pollInterval = setInterval(() => {
      if (syncingSuppliers.size > 0 || geminiSyncingSuppliers.size > 0) {
        fetchActiveSyncs();
        fetchSuppliers(); // Refresh to get updated last_sync_date
      }
    }, POLL_INTERVAL);

    return () => clearInterval(pollInterval);
  }, [syncingSuppliers.size, geminiSyncingSuppliers.size, fetchActiveSyncs]);

  const fetchSuppliers = async () => {
    try {
      const response = await get(
        "/content-manager/collection-types/api::supplier.supplier?page=1&pageSize=100&sort=code:ASC"
      );
      setSuppliers(response.data.results || []);
    } catch (error) {
      console.error("Failed to fetch suppliers:", error);
      toggleNotification({
        type: "warning",
        message: "Failed to load suppliers",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (supplier: any) => {
    setSyncingSuppliers((prev) => new Set(prev).add(supplier.documentId));

    try {
      const response = await post('/api/promidata-sync/start', {
        supplierId: supplier.documentId
      });

      if (response.data.success) {
        toggleNotification({
          type: "success",
          message: `Sync started for ${supplier.code}. Click "Stop" to cancel.`,
        });
      } else if (response.data.isRunning) {
        toggleNotification({
          type: "warning",
          message: `Sync already running for ${supplier.code}`,
        });
      } else {
        toggleNotification({
          type: "danger",
          message: response.data.message || "Sync failed to start",
        });
        setSyncingSuppliers((prev) => {
          const newSet = new Set(prev);
          newSet.delete(supplier.documentId);
          return newSet;
        });
      }
    } catch (error: any) {
      toggleNotification({
        type: "danger",
        message: `Sync failed for ${supplier.code}: ${error.response?.data?.error?.message || error.message}`,
      });
      setSyncingSuppliers((prev) => {
        const newSet = new Set(prev);
        newSet.delete(supplier.documentId);
        return newSet;
      });
    }
  };

  const handleStopSync = async (supplier: any) => {
    setStoppingSyncSuppliers((prev) => new Set(prev).add(supplier.documentId));

    try {
      const response = await post(`/api/promidata-sync/stop/${supplier.documentId}`);

      if (response.data.success) {
        toggleNotification({
          type: "success",
          message: `Stop signal sent for ${supplier.code}. Sync will stop after current batch.`,
        });
      } else {
        toggleNotification({
          type: "warning",
          message: response.data.message || "Failed to stop sync",
        });
      }
    } catch (error: any) {
      toggleNotification({
        type: "danger",
        message: `Failed to stop sync for ${supplier.code}: ${error.message}`,
      });
    } finally {
      setStoppingSyncSuppliers((prev) => {
        const newSet = new Set(prev);
        newSet.delete(supplier.documentId);
        return newSet;
      });
    }
  };

  const handleExport = async (supplier: any) => {
    setExportingSuppliers((prev) => new Set(prev).add(supplier.id));

    try {
      const response = await fetch(`/api/promidata-sync/export/${supplier.documentId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const exportData = await response.text();
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${supplier.code}_products_export.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toggleNotification({
        type: "success",
        message: `Export completed for ${supplier.code}. File downloaded successfully.`,
      });
    } catch (error: any) {
      toggleNotification({
        type: "danger",
        message: `Export failed for ${supplier.code}: ${error.message}`,
      });
    } finally {
      setExportingSuppliers((prev) => {
        const newSet = new Set(prev);
        newSet.delete(supplier.id);
        return newSet;
      });
    }
  };

  const handleGeminiSync = async (supplier: any) => {
    setGeminiSyncingSuppliers((prev) => new Set(prev).add(supplier.code));

    try {
      const response = await post('/api/gemini-sync/trigger-by-supplier', {
        supplierCode: supplier.code
      });

      if (response.data.success) {
        toggleNotification({
          type: "success",
          message: `Gemini sync started for ${supplier.code}. Click "Stop" to cancel.`,
        });
      } else if (response.data.isRunning) {
        toggleNotification({
          type: "warning",
          message: `Gemini sync already running for ${supplier.code}`,
        });
      } else {
        toggleNotification({
          type: "danger",
          message: response.data.message || "Gemini sync failed to start",
        });
        setGeminiSyncingSuppliers((prev) => {
          const newSet = new Set(prev);
          newSet.delete(supplier.code);
          return newSet;
        });
      }
    } catch (error: any) {
      toggleNotification({
        type: "danger",
        message: `Gemini sync failed for ${supplier.code}: ${error.message}`,
      });
      setGeminiSyncingSuppliers((prev) => {
        const newSet = new Set(prev);
        newSet.delete(supplier.code);
        return newSet;
      });
    }
  };

  const handleStopGeminiSync = async (supplier: any) => {
    setStoppingGeminiSuppliers((prev) => new Set(prev).add(supplier.code));

    try {
      const response = await post(`/api/gemini-sync/stop/${supplier.code}`);

      if (response.data.success) {
        toggleNotification({
          type: "success",
          message: `Stop signal sent for Gemini sync ${supplier.code}. Queue cleared.`,
        });
        // Remove from syncing set
        setGeminiSyncingSuppliers((prev) => {
          const newSet = new Set(prev);
          newSet.delete(supplier.code);
          return newSet;
        });
      } else {
        toggleNotification({
          type: "warning",
          message: response.data.message || "Failed to stop Gemini sync",
        });
      }
    } catch (error: any) {
      toggleNotification({
        type: "danger",
        message: `Failed to stop Gemini sync for ${supplier.code}: ${error.message}`,
      });
    } finally {
      setStoppingGeminiSuppliers((prev) => {
        const newSet = new Set(prev);
        newSet.delete(supplier.code);
        return newSet;
      });
    }
  };

  const getStatusBadge = (supplier: any) => {
    const isCurrentlySyncing = syncingSuppliers.has(supplier.documentId);
    const lastSyncStatus = supplier.last_sync_status;

    if (isCurrentlySyncing || lastSyncStatus === 'running') {
      return (
        <Badge backgroundColor="secondary500" textColor="neutral0">
          Syncing...
        </Badge>
      );
    }

    if (lastSyncStatus === 'failed') {
      return (
        <Tooltip description={supplier.last_sync_message || 'Sync failed'}>
          <Badge backgroundColor="danger500" textColor="neutral0">
            Failed
          </Badge>
        </Tooltip>
      );
    }

    const lastSync = supplier.last_sync_date;
    if (!lastSync) {
      return (
        <Badge backgroundColor="neutral150" textColor="neutral600">
          Never
        </Badge>
      );
    }

    return (
      <Tooltip description={supplier.last_sync_message || ''}>
        <Badge backgroundColor="success500" textColor="neutral0">
          {new Date(lastSync).toLocaleDateString()}
        </Badge>
      </Tooltip>
    );
  };

  if (loading) {
    return (
      <Main>
        <Box padding={8}>
          <Typography variant="alpha" tag="h1">
            Supplier Sync Management
          </Typography>
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
          {(syncingSuppliers.size > 0 || geminiSyncingSuppliers.size > 0) && (
            <Badge marginLeft={2} backgroundColor="secondary500" textColor="neutral0">
              {syncingSuppliers.size + geminiSyncingSuppliers.size} active
            </Badge>
          )}
        </Typography>

        <Box padding={6} background="neutral0" shadow="filterShadow" hasRadius>
          <Table colCount={7} rowCount={suppliers.length}>
            <Thead>
              <Tr>
                <Th>
                  <Typography variant="sigma">Supplier</Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">Code</Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">Products</Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">Status</Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">Promidata</Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">Gemini</Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">Export</Typography>
                </Th>
              </Tr>
            </Thead>
            <Tbody>
              {suppliers.map((supplier: any) => {
                const isSyncing = syncingSuppliers.has(supplier.documentId) || supplier.last_sync_status === 'running';
                const isStoppingSync = stoppingSyncSuppliers.has(supplier.documentId);
                const isGeminiSyncing = geminiSyncingSuppliers.has(supplier.code);
                const isStoppingGemini = stoppingGeminiSuppliers.has(supplier.code);

                return (
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
                      <Typography
                        variant="omega"
                        textColor={supplier.products_count > 0 ? "success600" : "neutral600"}
                        fontWeight={supplier.products_count > 0 ? "semiBold" : "normal"}
                      >
                        {supplier.products_count || 0}
                      </Typography>
                    </Td>
                    <Td>{getStatusBadge(supplier)}</Td>
                    <Td>
                      {isSyncing ? (
                        <Button
                          onClick={() => handleStopSync(supplier)}
                          loading={isStoppingSync}
                          disabled={isStoppingSync}
                          variant="danger"
                          size="S"
                          startIcon={<Cross />}
                        >
                          {isStoppingSync ? 'Stopping...' : 'Stop'}
                        </Button>
                      ) : (
                        <Tooltip description={`Sync ${supplier.name} products from Promidata`}>
                          <Button
                            onClick={() => handleSync(supplier)}
                            variant="secondary"
                            size="S"
                            startIcon={<Play />}
                          >
                            Sync
                          </Button>
                        </Tooltip>
                      )}
                    </Td>
                    <Td>
                      {isGeminiSyncing ? (
                        <Button
                          onClick={() => handleStopGeminiSync(supplier)}
                          loading={isStoppingGemini}
                          disabled={isStoppingGemini}
                          variant="danger"
                          size="S"
                          startIcon={<Cross />}
                        >
                          {isStoppingGemini ? 'Stopping...' : 'Stop'}
                        </Button>
                      ) : (
                        <Tooltip description={
                          !supplier.is_active
                            ? `Supplier ${supplier.name} is inactive`
                            : !supplier.products_count || supplier.products_count === 0
                            ? `No products synced yet. Sync from Promidata first.`
                            : `Sync ${supplier.name} products to Gemini File Search`
                        }>
                          <Button
                            onClick={() => handleGeminiSync(supplier)}
                            disabled={!supplier.is_active || !supplier.products_count || supplier.products_count === 0}
                            variant="tertiary"
                            size="S"
                            startIcon={<Database />}
                          >
                            Gemini
                          </Button>
                        </Tooltip>
                      )}
                    </Td>
                    <Td>
                      <Tooltip description={`Export ${supplier.name} products as JSON`}>
                        <Button
                          onClick={() => handleExport(supplier)}
                          loading={exportingSuppliers.has(supplier.id)}
                          disabled={exportingSuppliers.has(supplier.id) || !supplier.is_active}
                          variant="tertiary"
                          size="S"
                          startIcon={<Download />}
                        >
                          {exportingSuppliers.has(supplier.id) ? 'Exporting...' : 'Export'}
                        </Button>
                      </Tooltip>
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </Box>
      </Box>
    </Main>
  );
};

export default SupplierSyncPage;
