import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  LinearProgress
} from '@mui/material';
import {
  Sync as SyncIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  Business as BusinessIcon
} from '@mui/icons-material';

interface Supplier {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  auto_import: boolean;
  last_sync?: string;
  sync_status?: string;
  product_count?: number;
}

interface SyncResult {
  supplier: string;
  success: boolean;
  message?: string;
  productsProcessed?: number;
  imported?: number;
  updated?: number;
  errors?: number;
}

const SyncDashboard: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState<SyncResult[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [categoryImportOpen, setCategoryImportOpen] = useState(false);
  const [alert, setAlert] = useState<{type: 'success' | 'error' | 'info'; message: string} | null>(null);

  const API_TOKEN = '160e49880f218b1b8e5f81a5ea0c215689f3daaed4f3fbb0ce7e4b03afff9997d0d7d69b45c4f5358d491b5613134a39b61e949e176cd7caf9d090467eb78f5286ee5f620ddda2ee3c64d0410d4eef43fe94e9714d8bdd08c3e6f538fed12a0b280dcae0e566019d2ff04ba46f9d4dfd4a1ef3a772017444d68e8c2529bccf92';

  const apiCall = async (endpoint: string, options: RequestInit = {}) => {
    const response = await fetch(`http://localhost:1337/api${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  };

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      const response = await apiCall('/suppliers?populate=*&pagination[limit]=100');
      setSuppliers(response.data);
    } catch (error) {
      setAlert({ type: 'error', message: `Failed to load suppliers: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const loadSyncStatus = async () => {
    try {
      const response = await apiCall('/promidata-sync/status');
      if (response.success) {
        setSuppliers(current => 
          current.map(supplier => {
            const syncInfo = response.data.find((s: any) => s.id === supplier.id);
            return syncInfo ? { ...supplier, ...syncInfo } : supplier;
          })
        );
      }
    } catch (error) {
      console.error('Failed to load sync status:', error);
    }
  };

  const testConnection = async () => {
    try {
      setSyncing(true);
      const response = await apiCall('/promidata-sync/test-connection');
      if (response.success) {
        setAlert({ 
          type: 'success', 
          message: `Connection successful! Found ${response.data.suppliersFound} suppliers in Promidata.` 
        });
      } else {
        setAlert({ type: 'error', message: `Connection failed: ${response.data.error}` });
      }
    } catch (error) {
      setAlert({ type: 'error', message: `Connection test failed: ${error.message}` });
    } finally {
      setSyncing(false);
    }
  };

  const importCategories = async () => {
    try {
      setSyncing(true);
      setCategoryImportOpen(false);
      const response = await apiCall('/promidata-sync/import-categories', {
        method: 'POST'
      });
      
      if (response.success) {
        setAlert({ 
          type: 'success', 
          message: `Categories imported! Total: ${response.data.total}, Imported: ${response.data.imported}, Errors: ${response.data.errors}` 
        });
      } else {
        setAlert({ type: 'error', message: 'Category import failed' });
      }
    } catch (error) {
      setAlert({ type: 'error', message: `Category import failed: ${error.message}` });
    } finally {
      setSyncing(false);
    }
  };

  const startSync = async () => {
    if (selectedSuppliers.length === 0) {
      setAlert({ type: 'error', message: 'Please select at least one supplier to sync' });
      return;
    }

    try {
      setSyncing(true);
      setSyncDialogOpen(false);
      setSyncResults([]);

      for (const supplierId of selectedSuppliers) {
        try {
          const response = await apiCall('/promidata-sync/start', {
            method: 'POST',
            body: JSON.stringify({ supplierId })
          });

          if (response.success && response.data.results) {
            setSyncResults(current => [...current, ...response.data.results]);
          }
        } catch (error) {
          const supplier = suppliers.find(s => s.id === supplierId);
          setSyncResults(current => [...current, {
            supplier: supplier?.code || supplierId,
            success: false,
            message: error.message
          }]);
        }
      }

      await loadSyncStatus();
      setAlert({ type: 'success', message: 'Sync completed! Check results below.' });
    } catch (error) {
      setAlert({ type: 'error', message: `Sync failed: ${error.message}` });
    } finally {
      setSyncing(false);
    }
  };

  const toggleSupplierAutoImport = async (supplierId: string, autoImport: boolean) => {
    try {
      await apiCall(`/suppliers/${supplierId}`, {
        method: 'PUT',
        body: JSON.stringify({
          data: { auto_import: autoImport }
        })
      });
      
      setSuppliers(current =>
        current.map(supplier =>
          supplier.id === supplierId 
            ? { ...supplier, auto_import: autoImport }
            : supplier
        )
      );
      
      setAlert({ 
        type: 'success', 
        message: `Auto-import ${autoImport ? 'enabled' : 'disabled'} for supplier` 
      });
    } catch (error) {
      setAlert({ type: 'error', message: `Failed to update supplier: ${error.message}` });
    }
  };

  const getSyncStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'failed': return 'error';
      case 'running': return 'warning';
      default: return 'default';
    }
  };

  const getSyncStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckIcon />;
      case 'failed': return <ErrorIcon />;
      case 'running': return <ScheduleIcon />;
      default: return <ScheduleIcon />;
    }
  };

  useEffect(() => {
    loadSuppliers();
    loadSyncStatus();
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box p={3}>
      {/* Header */}
      <Box mb={3}>
        <Typography variant="h4" gutterBottom>
          <SyncIcon sx={{ mr: 1 }} />
          Promidata Sync Dashboard
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Manage product synchronization from Promidata suppliers
        </Typography>
      </Box>

      {/* Alert */}
      {alert && (
        <Alert 
          severity={alert.type} 
          onClose={() => setAlert(null)}
          sx={{ mb: 3 }}
        >
          {alert.message}
        </Alert>
      )}

      {/* Action Buttons */}
      <Box mb={3}>
        <Grid container spacing={2}>
          <Grid item>
            <Button
              variant="contained"
              startIcon={<SyncIcon />}
              onClick={() => setSyncDialogOpen(true)}
              disabled={syncing}
              color="primary"
            >
              Start Manual Sync
            </Button>
          </Grid>
          <Grid item>
            <Button
              variant="outlined"
              startIcon={<BusinessIcon />}
              onClick={() => setCategoryImportOpen(true)}
              disabled={syncing}
            >
              Import Categories
            </Button>
          </Grid>
          <Grid item>
            <Button
              variant="outlined"
              onClick={testConnection}
              disabled={syncing}
            >
              Test Connection
            </Button>
          </Grid>
          <Grid item>
            <Button
              variant="outlined"
              onClick={loadSyncStatus}
              disabled={syncing}
            >
              Refresh Status
            </Button>
          </Grid>
        </Grid>
      </Box>

      {/* Sync Progress */}
      {syncing && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Sync in Progress...
            </Typography>
            <LinearProgress />
          </CardContent>
        </Card>
      )}

      {/* Sync Results */}
      {syncResults.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Last Sync Results
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Supplier</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Products</TableCell>
                    <TableCell>Imported</TableCell>
                    <TableCell>Updated</TableCell>
                    <TableCell>Errors</TableCell>
                    <TableCell>Message</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {syncResults.map((result, index) => (
                    <TableRow key={index}>
                      <TableCell>{result.supplier}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={result.success ? 'success' : 'error'}
                          label={result.success ? 'Success' : 'Failed'}
                        />
                      </TableCell>
                      <TableCell>{result.productsProcessed || 0}</TableCell>
                      <TableCell>{result.imported || 0}</TableCell>
                      <TableCell>{result.updated || 0}</TableCell>
                      <TableCell>{result.errors || 0}</TableCell>
                      <TableCell>{result.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Suppliers Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Suppliers ({suppliers.length})
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Code</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Auto Import</TableCell>
                  <TableCell>Last Sync</TableCell>
                  <TableCell>Sync Status</TableCell>
                  <TableCell>Products</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {suppliers.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {supplier.code}
                      </Typography>
                    </TableCell>
                    <TableCell>{supplier.name}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={supplier.is_active ? 'success' : 'default'}
                        label={supplier.is_active ? 'Active' : 'Inactive'}
                      />
                    </TableCell>
                    <TableCell>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={supplier.auto_import}
                            onChange={(e) => toggleSupplierAutoImport(supplier.id, e.target.checked)}
                            disabled={!supplier.is_active}
                          />
                        }
                        label=""
                      />
                    </TableCell>
                    <TableCell>
                      {supplier.last_sync 
                        ? new Date(supplier.last_sync).toLocaleDateString()
                        : 'Never'
                      }
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={getSyncStatusColor(supplier.sync_status || 'never')}
                        icon={getSyncStatusIcon(supplier.sync_status || 'never')}
                        label={supplier.sync_status || 'Never'}
                      />
                    </TableCell>
                    <TableCell>{supplier.product_count || 0}</TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          setSelectedSuppliers([supplier.id]);
                          setSyncDialogOpen(true);
                        }}
                        disabled={!supplier.is_active || syncing}
                      >
                        Sync Now
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Manual Sync Dialog */}
      <Dialog open={syncDialogOpen} onClose={() => setSyncDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Start Manual Sync</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Select suppliers to synchronize:
          </Typography>
          <Box mt={2}>
            {suppliers.filter(s => s.is_active).map((supplier) => (
              <FormControlLabel
                key={supplier.id}
                control={
                  <Switch
                    checked={selectedSuppliers.includes(supplier.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedSuppliers(current => [...current, supplier.id]);
                      } else {
                        setSelectedSuppliers(current => current.filter(id => id !== supplier.id));
                      }
                    }}
                  />
                }
                label={`${supplier.code} - ${supplier.name}`}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSyncDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={startSync}
            disabled={selectedSuppliers.length === 0}
          >
            Start Sync ({selectedSuppliers.length} suppliers)
          </Button>
        </DialogActions>
      </Dialog>

      {/* Category Import Dialog */}
      <Dialog open={categoryImportOpen} onClose={() => setCategoryImportOpen(false)}>
        <DialogTitle>Import Categories</DialogTitle>
        <DialogContent>
          <Typography>
            This will import all product categories from Promidata's CAT.csv file.
            Existing categories will be updated with new information.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCategoryImportOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={importCategories}>
            Import Categories
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SyncDashboard;