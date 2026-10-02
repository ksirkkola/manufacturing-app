import { useEffect, useState } from 'react';
import {
  Box, Button, Flex, Heading, Icon, Spinner, Tab, TabList, TabPanel, TabPanels,
  Tabs, Text, useColorMode, useColorModeValue, Badge,
} from '@chakra-ui/react';
import { useApp } from './hailer/use-app';
import { useRefresh } from './hailer/use-refresh';
import OverviewTab from './components/OverviewTab';
import WorkOrdersTab from './components/WorkOrdersTab';
import PartsPickingTab from './components/PartsPickingTab';
import InventoryTab from './components/InventoryTab';
import StockTransactionsTab from './components/StockTransactionsTab';
import SensorsTab from './components/SensorsTab';
import PurchaseOrdersTab from './components/PurchaseOrdersTab';
import ReferenceTab from './components/ReferenceTab';
import { HailerInfo } from './hailer/theme/icons/HailerInfo';

// Tab order: Reference, Overview, Inventory, Sensors, Parts Picking, Purchase Orders,
// Work Orders, Stock History. Keep this in sync with OverviewTab's internal TAB map.
// Reference sits first (visual convention shared with other apps), but Overview stays
// the default landing view — see the tabIndex initial state below.
const TAB_OVERVIEW      = 1;
const TAB_PARTS_PICKING = 4;

declare const __APP_VERSION__: string;

export default function App() {
  const { api, inside, ready, settings } = useApp();
  const { setColorMode } = useColorMode();
  const { refreshKey, refresh, fmtLastUpdated } = useRefresh();
  const [tabIndex, setTabIndex]             = useState(TAB_OVERVIEW);
  const [selectedWOId, setSelectedWOId]     = useState<string | undefined>();
  const [selectedWOName, setSelectedWOName] = useState<string | undefined>();

  const bg          = useColorModeValue('gray.50', 'gray.900');
  const headerBg    = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const mutedText   = useColorModeValue('gray.400', 'gray.500');

  useEffect(() => { void api.init(); }, [api]);

  useEffect(() => {
    if (settings?.theme === 'dark') setColorMode('dark');
    else if (settings?.theme) setColorMode('light');
  }, [settings, setColorMode]);

  function handleSelectWorkOrder(id: string, name: string) {
    setSelectedWOId(id);
    setSelectedWOName(name);
    setTabIndex(TAB_PARTS_PICKING);
  }

  if (!inside) return (
    <Flex h="100vh" align="center" justify="center">
      <Text color="gray.500">Open this app inside Hailer</Text>
    </Flex>
  );

  if (!ready) return (
    <Flex h="100vh" align="center" justify="center">
      <Spinner size="xl" />
    </Flex>
  );

  return (
    <Box minH="100vh" bg={bg}>
      <Box bg={headerBg} px={6} py={4} borderBottom="1px" borderColor={borderColor} mb={4}>
        <Flex align="center" justify="space-between">
          <Heading size="md">Manufacturing & Assembly</Heading>
          <Flex align="center" gap={3}>
            <Text fontSize="xs" color={mutedText}>Updated {fmtLastUpdated()}</Text>
            <Button size="sm" variant="outline" onClick={refresh}>↻ Refresh</Button>
          </Flex>
        </Flex>
      </Box>

      <Box px={6} pb={8}>
        <Tabs variant="enclosed" colorScheme="purple" index={tabIndex} onChange={setTabIndex} isLazy>
          <TabList mb={4}>
            <Tab fontWeight="semibold"><Icon as={HailerInfo} mr="0.3em" />Reference</Tab>
            <Tab fontWeight="semibold">Overview</Tab>
            <Tab fontWeight="semibold">Inventory</Tab>
            <Tab fontWeight="semibold">Sensors</Tab>
            <Tab fontWeight="semibold">
              Parts Picking
              {selectedWOName && (
                <Badge ml={2} colorScheme="purple" fontSize="xs" maxW="150px" isTruncated>
                  {selectedWOName}
                </Badge>
              )}
            </Tab>
            <Tab fontWeight="semibold">Purchase Orders</Tab>
            <Tab fontWeight="semibold">Work Orders</Tab>
            <Tab fontWeight="semibold">Stock History</Tab>
          </TabList>

          <TabPanels>
            <TabPanel px={0}>
              <ReferenceTab />
            </TabPanel>
            <TabPanel px={0}>
              <OverviewTab refreshKey={refreshKey} onNavigate={setTabIndex} />
            </TabPanel>
            <TabPanel px={0}>
              <InventoryTab refreshKey={refreshKey} />
            </TabPanel>
            <TabPanel px={0}>
              <SensorsTab refreshKey={refreshKey} />
            </TabPanel>
            <TabPanel px={0}>
              <PartsPickingTab selectedWorkOrderId={selectedWOId} selectedWorkOrderName={selectedWOName} refreshKey={refreshKey} />
            </TabPanel>
            <TabPanel px={0}>
              <PurchaseOrdersTab refreshKey={refreshKey} />
            </TabPanel>
            <TabPanel px={0}>
              <WorkOrdersTab onSelectWorkOrder={handleSelectWorkOrder} refreshKey={refreshKey} />
            </TabPanel>
            <TabPanel px={0}>
              <StockTransactionsTab refreshKey={refreshKey} onDataChanged={refresh} />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </Box>

      <Text fontSize="xs" color="gray.400" position="fixed" bottom={1} right={2}>
        v{__APP_VERSION__}
      </Text>
    </Box>
  );
}
