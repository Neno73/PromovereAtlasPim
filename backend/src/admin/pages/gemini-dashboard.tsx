import React, { useState, useEffect } from "react";
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
  TextInput,
  Loader,
} from "@strapi/design-system";
import {
  CheckCircle,
  Cross,
  Play,
  Clock,
  Database,
  Plus,
  Trash,
} from "@strapi/icons";
import { useFetchClient, useNotification } from "@strapi/strapi/admin";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface StoreInfo {
  found: boolean;
  storeId?: string;
  displayName?: string;
  name?: string;
  createTime?: string;
  updateTime?: string;
  state?: string;
  error?: string;
}

interface DetailedStats {
  activeDocuments: number;
  pendingDocuments: number;
  failedDocuments: number;
  totalDocuments: number;
  syncedProducts: number;
  totalProducts: number;
  coverage: number;
  totalBytes: number;
  storeId?: string;
  displayName?: string;
  createTime?: string;
  updateTime?: string;
}

interface ActiveSync {
  supplierCode: string;
  lockInfo: {
    lockedAt: string;
    syncId: string;
  };
}

interface FileSearchStore {
  storeId: string;
  displayName: string;
  createTime: string;
  updateTime: string;
}

interface SearchHistoryItem {
  query: string;
  timestamp: string;
  responseLength: number;
  tokenCount: number;
}

const COLORS = {
  active: "#5cb85c",    // Green
  pending: "#f0ad4e",   // Orange
  failed: "#d9534f",    // Red
  success: "#5bc0de",   // Blue
};

const GeminiDashboard = () => {
  const [detailedStats, setDetailedStats] = useState<DetailedStats | null>(null);
  const [health, setHealth] = useState<boolean | null>(null);
  const [activeSyncs, setActiveSyncs] = useState<ActiveSync[]>([]);
  const [stores, setStores] = useState<FileSearchStore[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [showCreateStoreModal, setShowCreateStoreModal] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [creating, setCreating] = useState(false);

  const { post, del } = useFetchClient();
  const { toggleNotification } = useNotification();

  // Fetch all dashboard data
  const fetchDashboardData = async () => {
    try {
      setRefreshing(true);

      // Fetch detailed stats (Phase 1)
      const detailedStatsResponse = await fetch("/api/gemini-sync/detailed-stats");
      const detailedStatsData = await detailedStatsResponse.json();
      if (detailedStatsData.success) {
        setDetailedStats(detailedStatsData.stats);
        setHealth(true);
      } else {
        setHealth(false);
      }

      // Fetch active syncs
      const activeSyncsResponse = await fetch("/api/gemini-sync/active");
      const activeSyncsData = await activeSyncsResponse.json();
      if (activeSyncsData.success) {
        setActiveSyncs(activeSyncsData.data);
      }

      // Fetch stores (Phase 2)
      const storesResponse = await fetch("/api/gemini-sync/stores");
      const storesData = await storesResponse.json();
      if (storesData.success) {
        setStores(storesData.data);
      }

      // Fetch search history (Phase 2)
      const searchHistoryResponse = await fetch("/api/gemini-sync/search-history?limit=10");
      const searchHistoryData = await searchHistoryResponse.json();
      if (searchHistoryData.success) {
        setSearchHistory(searchHistoryData.data);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
      toggleNotification({
        type: "danger",
        message: "Failed to load dashboard data",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Poll for updates every 10 seconds
    const interval = setInterval(() => {
      if (activeSyncs.length > 0) {
        fetchDashboardData();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [activeSyncs.length]);

  const handleTestSearch = async () => {
    console.log('🔍 handleTestSearch called with query:', searchQuery);

    if (!searchQuery.trim()) {
      console.warn('⚠️ Empty search query');
      toggleNotification({
        type: "warning",
        message: "Please enter a search query",
      });
      return;
    }

    try {
      setSearching(true);
      console.log('📤 Making POST request to /api/gemini-sync/test-search');
      console.log('📦 Request payload:', { data: { query: searchQuery } });

      const response = await post("/api/gemini-sync/test-search", {
        data: { query: searchQuery },
      });

      console.log('📥 Response received:', response);

      if (response.data.success) {
        console.log('✅ Search successful:', response.data.data);
        setSearchResult(response.data.data);
        toggleNotification({
          type: "success",
          message: "Search completed successfully",
        });
        // Refresh search history
        fetchDashboardData();
      } else {
        console.error('❌ Search failed:', response.data.error);
        toggleNotification({
          type: "danger",
          message: response.data.error || "Search failed",
        });
      }
    } catch (error: any) {
      console.error('💥 Exception caught:', error);
      console.error('Error details:', { message: error.message, stack: error.stack });
      toggleNotification({
        type: "danger",
        message: `Search failed: ${error.message}`,
      });
    } finally {
      console.log('🏁 setSearching(false)');
      setSearching(false);
    }
  };

  const handleCreateStore = async () => {
    if (!newStoreName.trim()) {
      toggleNotification({
        type: "warning",
        message: "Please enter a store name",
      });
      return;
    }

    try {
      setCreating(true);
      const response = await post("/api/gemini-sync/stores/create", {
        data: { displayName: newStoreName },
      });

      if (response.data.success) {
        toggleNotification({
          type: "success",
          message: "Store created successfully",
        });
        setShowCreateStoreModal(false);
        setNewStoreName("");
        fetchDashboardData();
      } else {
        toggleNotification({
          type: "danger",
          message: response.data.error || "Failed to create store",
        });
      }
    } catch (error: any) {
      toggleNotification({
        type: "danger",
        message: `Failed to create store: ${error.message}`,
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteStore = async (storeId: string) => {
    if (!confirm("Are you sure you want to delete this store? This action cannot be undone.")) {
      return;
    }

    try {
      const response = await del(`/api/gemini-sync/stores/${storeId}`, {
        data: { force: false },
      });

      if (response.data.success) {
        toggleNotification({
          type: "success",
          message: "Store deleted successfully",
        });
        fetchDashboardData();
      } else {
        toggleNotification({
          type: "danger",
          message: response.data.error || "Failed to delete store",
        });
      }
    } catch (error: any) {
      toggleNotification({
        type: "danger",
        message: `Failed to delete store: ${error.message}`,
      });
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  // Prepare data for pie chart (Phase 1)
  const chartData = detailedStats
    ? [
        { name: "Active", value: detailedStats.activeDocuments, color: COLORS.active },
        { name: "Pending", value: detailedStats.pendingDocuments, color: COLORS.pending },
        { name: "Failed", value: detailedStats.failedDocuments, color: COLORS.failed },
      ].filter((item) => item.value > 0)
    : [];

  if (loading) {
    return (
      <Main>
        <Box padding={8}>
          <Flex justifyContent="center">
            <Loader>Loading dashboard...</Loader>
          </Flex>
        </Box>
      </Main>
    );
  }

  return (
    <Main>
      <Box padding={8}>
        <Flex direction="column" gap={6}>
          {/* Header */}
          <Flex justifyContent="space-between" alignItems="center">
            <Typography variant="alpha">Gemini FileSearchStore Dashboard</Typography>
            <Button
              onClick={fetchDashboardData}
              loading={refreshing}
              startIcon={<Play />}
              variant="secondary"
            >
              Refresh
            </Button>
          </Flex>

          {/* Health Status */}
          <Box background="neutral100" padding={4} hasRadius>
            <Typography variant="delta" marginBottom={3}>
              System Health
            </Typography>
            <Flex gap={4} alignItems="center">
              {health ? (
                <>
                  <CheckCircle fill="success600" />
                  <Badge backgroundColor="success100" textColor="success700">
                    Operational
                  </Badge>
                  <Typography>FileSearchStore is accessible and healthy</Typography>
                </>
              ) : (
                <>
                  <Cross fill="danger600" />
                  <Badge backgroundColor="danger100" textColor="danger700">
                    Unhealthy
                  </Badge>
                  <Typography>Cannot access FileSearchStore</Typography>
                </>
              )}
            </Flex>
          </Box>

          {/* Phase 1: Advanced Statistics with Document Status */}
          <Flex gap={4} wrap="wrap">
            <Box background="neutral100" padding={4} hasRadius style={{ flex: "1 1 calc(20% - 12px)", minWidth: "180px" }}>
              <Flex direction="column" gap={2}>
                <Typography variant="sigma" textColor="neutral600">
                  Active Documents
                </Typography>
                <Typography variant="alpha" style={{ color: COLORS.active }}>
                  {detailedStats?.activeDocuments || 0}
                </Typography>
              </Flex>
            </Box>

            <Box background="neutral100" padding={4} hasRadius style={{ flex: "1 1 calc(20% - 12px)", minWidth: "180px" }}>
              <Flex direction="column" gap={2}>
                <Typography variant="sigma" textColor="neutral600">
                  Pending Documents
                </Typography>
                <Typography variant="alpha" style={{ color: COLORS.pending }}>
                  {detailedStats?.pendingDocuments || 0}
                </Typography>
              </Flex>
            </Box>

            <Box background="neutral100" padding={4} hasRadius style={{ flex: "1 1 calc(20% - 12px)", minWidth: "180px" }}>
              <Flex direction="column" gap={2}>
                <Typography variant="sigma" textColor="neutral600">
                  Failed Documents
                </Typography>
                <Typography variant="alpha" style={{ color: COLORS.failed }}>
                  {detailedStats?.failedDocuments || 0}
                </Typography>
              </Flex>
            </Box>

            <Box background="neutral100" padding={4} hasRadius style={{ flex: "1 1 calc(20% - 12px)", minWidth: "180px" }}>
              <Flex direction="column" gap={2}>
                <Typography variant="sigma" textColor="neutral600">
                  Synced Products
                </Typography>
                <Typography variant="alpha">{detailedStats?.syncedProducts || 0}</Typography>
              </Flex>
            </Box>

            <Box background="neutral100" padding={4} hasRadius style={{ flex: "1 1 calc(20% - 12px)", minWidth: "180px" }}>
              <Flex direction="column" gap={2}>
                <Typography variant="sigma" textColor="neutral600">
                  Coverage
                </Typography>
                <Typography variant="alpha">
                  {detailedStats?.coverage || 0}%
                </Typography>
              </Flex>
            </Box>
          </Flex>

          {/* Phase 1: Visual Chart - Document Status Distribution */}
          {chartData.length > 0 && (
            <Box background="neutral100" padding={4} hasRadius>
              <Typography variant="delta" marginBottom={3}>
                Document Status Distribution
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          )}

          {/* Phase 1: Operations Monitoring Panel */}
          {activeSyncs.length > 0 && (
            <Box background="neutral100" padding={4} hasRadius>
              <Flex gap={2} alignItems="center" marginBottom={3}>
                <Clock />
                <Typography variant="delta">Active Operations</Typography>
                <Badge backgroundColor="primary100" textColor="primary700">
                  {activeSyncs.length}
                </Badge>
              </Flex>
              <Table colCount={3} rowCount={activeSyncs.length}>
                <Thead>
                  <Tr>
                    <Th>
                      <Typography variant="sigma">Supplier Code</Typography>
                    </Th>
                    <Th>
                      <Typography variant="sigma">Sync ID</Typography>
                    </Th>
                    <Th>
                      <Typography variant="sigma">Started At</Typography>
                    </Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {activeSyncs.map((sync, idx) => (
                    <Tr key={idx}>
                      <Td>
                        <Typography fontWeight="bold">{sync.supplierCode}</Typography>
                      </Td>
                      <Td>
                        <Typography variant="pi" textColor="neutral600">
                          {sync.lockInfo.syncId}
                        </Typography>
                      </Td>
                      <Td>
                        <Typography>{formatDate(sync.lockInfo.lockedAt)}</Typography>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          )}

          {/* Phase 2: Store Management UI */}
          <Box background="neutral100" padding={4} hasRadius>
            <Flex justifyContent="space-between" alignItems="center" marginBottom={3}>
              <Typography variant="delta">FileSearchStores</Typography>
              <Button
                onClick={() => setShowCreateStoreModal(true)}
                startIcon={<Plus />}
                size="S"
              >
                Create Store
              </Button>
            </Flex>

            {stores.length > 0 ? (
              <Table colCount={4} rowCount={stores.length}>
                <Thead>
                  <Tr>
                    <Th>
                      <Typography variant="sigma">Display Name</Typography>
                    </Th>
                    <Th>
                      <Typography variant="sigma">Store ID</Typography>
                    </Th>
                    <Th>
                      <Typography variant="sigma">Last Updated</Typography>
                    </Th>
                    <Th>
                      <Typography variant="sigma">Actions</Typography>
                    </Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {stores.map((store, idx) => (
                    <Tr key={idx}>
                      <Td>
                        <Typography fontWeight="bold">{store.displayName}</Typography>
                      </Td>
                      <Td>
                        <Typography variant="pi" textColor="neutral600">
                          {store.storeId}
                        </Typography>
                      </Td>
                      <Td>
                        <Typography>{formatDate(store.updateTime)}</Typography>
                      </Td>
                      <Td>
                        <Button
                          onClick={() => handleDeleteStore(store.storeId)}
                          startIcon={<Trash />}
                          variant="danger-light"
                          size="S"
                        >
                          Delete
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            ) : (
              <Typography>No stores found</Typography>
            )}
          </Box>

          {/* Phase 2: Search History */}
          {searchHistory.length > 0 && (
            <Box background="neutral100" padding={4} hasRadius>
              <Typography variant="delta" marginBottom={3}>
                Recent Search History
              </Typography>
              <Table colCount={3} rowCount={searchHistory.length}>
                <Thead>
                  <Tr>
                    <Th>
                      <Typography variant="sigma">Query</Typography>
                    </Th>
                    <Th>
                      <Typography variant="sigma">Timestamp</Typography>
                    </Th>
                    <Th>
                      <Typography variant="sigma">Tokens Used</Typography>
                    </Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {searchHistory.map((item, idx) => (
                    <Tr key={idx}>
                      <Td>
                        <Typography>{item.query}</Typography>
                      </Td>
                      <Td>
                        <Typography>{formatDate(item.timestamp)}</Typography>
                      </Td>
                      <Td>
                        <Typography>{item.tokenCount}</Typography>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          )}

          {/* Store Details */}
          {detailedStats && (
            <Box background="neutral100" padding={4} hasRadius>
              <Typography variant="delta" marginBottom={3}>
                Current Store Details
              </Typography>
              <Table colCount={2} rowCount={5}>
                <Tbody>
                  <Tr>
                    <Td>
                      <Typography fontWeight="bold">Display Name</Typography>
                    </Td>
                    <Td>
                      <Typography>{detailedStats.displayName}</Typography>
                    </Td>
                  </Tr>
                  <Tr>
                    <Td>
                      <Typography fontWeight="bold">Store ID</Typography>
                    </Td>
                    <Td>
                      <Typography textColor="neutral600" variant="pi">
                        {detailedStats.storeId}
                      </Typography>
                    </Td>
                  </Tr>
                  <Tr>
                    <Td>
                      <Typography fontWeight="bold">Total Documents</Typography>
                    </Td>
                    <Td>
                      <Typography>{detailedStats.totalDocuments}</Typography>
                    </Td>
                  </Tr>
                  <Tr>
                    <Td>
                      <Typography fontWeight="bold">Total Size</Typography>
                    </Td>
                    <Td>
                      <Typography>{formatBytes(detailedStats.totalBytes)}</Typography>
                    </Td>
                  </Tr>
                  <Tr>
                    <Td>
                      <Typography fontWeight="bold">Last Updated</Typography>
                    </Td>
                    <Td>
                      <Typography>{formatDate(detailedStats.updateTime || "")}</Typography>
                    </Td>
                  </Tr>
                </Tbody>
              </Table>
            </Box>
          )}

          {/* Semantic Search Test */}
          <Box background="neutral100" padding={4} hasRadius>
            <Typography variant="delta" marginBottom={3}>
              Test Semantic Search
            </Typography>
            <Flex direction="column" gap={4}>
              <Flex gap={2}>
                <Box style={{ flex: 1 }}>
                  <TextInput
                    placeholder="Enter a search query (e.g., 'Show me chewing gum products')"
                    value={searchQuery}
                    onChange={(e: any) => setSearchQuery(e.target.value)}
                    onKeyPress={(e: any) => {
                      if (e.key === "Enter") {
                        handleTestSearch();
                      }
                    }}
                  />
                </Box>
                <Button onClick={handleTestSearch} loading={searching}>
                  Search
                </Button>
              </Flex>

              {searchResult && (
                <Box
                  padding={4}
                  background="neutral0"
                  hasRadius
                  style={{ maxHeight: "400px", overflow: "auto" }}
                >
                  <Flex direction="column" gap={3}>
                    <Typography variant="delta">Response</Typography>
                    <Typography>{searchResult.responseText || "No response"}</Typography>

                    {searchResult.usage && (
                      <>
                        <Typography variant="delta" marginTop={3}>
                          Usage Stats
                        </Typography>
                        <Typography variant="pi" textColor="neutral600">
                          Prompt tokens: {searchResult.usage.promptTokenCount || 0} |
                          Candidates tokens: {searchResult.usage.candidatesTokenCount || 0} |
                          Total tokens: {searchResult.usage.totalTokenCount || 0}
                        </Typography>
                      </>
                    )}
                  </Flex>
                </Box>
              )}
            </Flex>
          </Box>
        </Flex>
      </Box>

      {/* Create Store Inline Form */}
      {showCreateStoreModal && (
        <Box background="neutral100" padding={4} hasRadius>
          <Typography variant="delta" marginBottom={3}>
            Create New FileSearchStore
          </Typography>
          <Flex direction="column" gap={3}>
            <TextInput
              label="Store Display Name"
              placeholder="Enter store name (e.g., 'Product Catalog 2024')"
              value={newStoreName}
              onChange={(e: any) => setNewStoreName(e.target.value)}
            />
            <Flex gap={2}>
              <Button onClick={handleCreateStore} loading={creating}>
                Create
              </Button>
              <Button onClick={() => setShowCreateStoreModal(false)} variant="tertiary">
                Cancel
              </Button>
            </Flex>
          </Flex>
        </Box>
      )}
    </Main>
  );
};

export default GeminiDashboard;
