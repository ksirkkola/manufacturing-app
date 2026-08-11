import { useEffect, useState } from 'react';
import {
  Box, Button, Flex, Heading, Spinner, Tab, TabList, TabPanel, TabPanels,
  Tabs, Text, useColorMode, useColorModeValue, Badge,
} from '@chakra-ui/react';
import { useApp } from './hailer/use-app';
import { useRefresh } from './hailer/use-refresh';
import WorkOrdersTab from './components/WorkOrdersTab';
import PartsPickingTab from './components/PartsPickingTab';
import InventoryTab from './components/InventoryTab';
import StockTransactionsTab from './components/StockTransactionsTab';

export default function App() {
  const { api, inside, ready, settings } = useApp();
  const { setColorMode } = useColorMode();
  const { refreshKey, refresh, fmtLastUpdated } = useRefresh();
  const [tabIndex, setTabIndex]             = useState(0);
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
    setTabIndex(1);
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
        <Tabs variant="enclosed" colorScheme="purple" index={tabIndex} onChange={setTabIndex}>
          <TabList mb={4}>
            <Tab fontWeight="semibold">Work Orders</Tab>
            <Tab fontWeight="semibold">
              Parts Picking
              {selectedWOName && (
                <Badge ml={2} colorScheme="purple" fontSize="xs" maxW="150px" isTruncated>
                  {selectedWOName}
                </Badge>
              )}
            </Tab>
            <Tab fontWeight="semibold">Inventory</Tab>
            <Tab fontWeight="semibold">Stock History</Tab>
          </TabList>

          <TabPanels>
            <TabPanel px={0}>
              <WorkOrdersTab onSelectWorkOrder={handleSelectWorkOrder} refreshKey={refreshKey} />
            </TabPanel>
            <TabPanel px={0}>
              <PartsPickingTab selectedWorkOrderId={selectedWOId} selectedWorkOrderName={selectedWOName} refreshKey={refreshKey} />
            </TabPanel>
            <TabPanel px={0}>
              <InventoryTab refreshKey={refreshKey} />
            </TabPanel>
            <TabPanel px={0}>
              <StockTransactionsTab refreshKey={refreshKey} />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </Box>
    </Box>
  );
}
