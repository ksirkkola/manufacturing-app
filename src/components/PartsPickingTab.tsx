import {
  Box, Badge, Button, Flex, Heading, HStack, Select, Spinner,
  Table, Tbody, Td, Text, Th, Thead, Tr, useColorModeValue,
  useToast, VStack, Alert, AlertIcon, Tabs, TabList, Tab, TabPanels, TabPanel,
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { useApp } from '../hailer/use-app';

const INSIGHT_LINE_ITEMS  = '6a4dddd2fd36d690158cc19b';
const INSIGHT_WORK_ORDERS = '6a4ddad5d9b751c8857618a6';
const INSIGHT_TRIPS       = '6a4dec164d698d6a7fd73078';

// Line Item phase IDs
const PHASE_PENDING     = '6a4c9c94a218e0e0d33d27b4';
const PHASE_PICKED      = '6a4c9c96a218e0e0d33d27e2';
const PHASE_BACKORDERED = '6a4c9c98a218e0e0d33d2825';

// Inventory field + workflow
const INV_FIELD_QTY = '6a0c251a19566c76c8492813';

// Stock Transaction workflow + phase
const STOCK_TXN_WORKFLOW = '6a4deba315df0324e505360c';
const STOCK_TXN_PHASE    = '6a4debd498370c6b89ab64e9'; // Posted

// Stock Transaction field IDs
const STF_TYPE      = '6a4debd94d698d6a7fd72f98';
const STF_ITEM      = '6a4debd94d698d6a7fd72f9b';
const STF_SKU       = '6a4debd94d698d6a7fd72f9e';
const STF_QTY       = '6a4debda4d698d6a7fd72fa1';
const STF_DIRECTION = '6a4debda4d698d6a7fd72fa4';
const STF_DATE      = '6a4debda4d698d6a7fd72fa7';
const STF_WO        = '6a4debda4d698d6a7fd72fad';
const STF_TRIP      = '6a4debda4d698d6a7fd72fb0';
const STF_NOTES     = '6a4debda4d698d6a7fd72fb9';

// Work Order Line Item workflow
const WO_LINE_ITEM_WORKFLOW = '6a4c9c51b7d11c3c37c9ca90';

interface LineItemRow {
  id: string;
  name: string;
  phase: string;
  workOrder: string | null;
  trip: string | null;
  inventoryItem: string | null;
  partNumber: string | null;
  description: string | null;
  quantityRequired: number | null;
  quantityPicked: number | null;
  unitCost: number | null;
  notes: string | null;
  transactionType: string | null;
}

interface Option { id: string; name: string; }

function parseInsight(data: { headers: string[]; rows: unknown[][] }): Record<string, unknown>[] {
  return data.rows.map(row => {
    const r: Record<string, unknown> = {};
    data.headers.forEach((h, i) => { r[h] = row[i]; });
    return r;
  });
}

const PHASE_COLOR: Record<string, string> = {
  'Pending': 'yellow', 'Picked': 'green', 'Backordered': 'red',
};

interface Props {
  selectedWorkOrderId?: string;
  selectedWorkOrderName?: string;
  refreshKey?: number;
}

export default function PartsPickingTab({ selectedWorkOrderId, selectedWorkOrderName, refreshKey = 0 }: Props) {
  const { hailer, inside } = useApp();
  const toast = useToast();

  const [lineItems, setLineItems]   = useState<LineItemRow[]>([]);
  const [workOrders, setWorkOrders] = useState<Option[]>([]);
  const [trips, setTrips]           = useState<Option[]>([]);
  const [selectedWO, setSelectedWO] = useState(selectedWorkOrderId || '');
  const [selectedTrip, setSelectedTrip] = useState('');
  const [loading, setLoading]       = useState(true);
  const [updating, setUpdating]     = useState<string | null>(null);
  const [error, setError]           = useState<string | null>(null);

  const cardBg      = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const theadBg     = useColorModeValue('gray.50', 'gray.800');
  const rowHover    = useColorModeValue('gray.50', 'gray.600');
  const greenRow    = useColorModeValue('green.50', 'green.900');
  const redRow      = useColorModeValue('red.50', 'red.900');

  useEffect(() => {
    if (!inside) return;
    setLoading(true);
    Promise.all([
      hailer!.insight.data(INSIGHT_LINE_ITEMS, { update: true }),
      hailer!.insight.data(INSIGHT_WORK_ORDERS, { update: true }),
      hailer!.insight.data(INSIGHT_TRIPS, { update: true }),
    ]).then(([items, wos, tripsData]) => {
      setLineItems(parseInsight(items) as unknown as LineItemRow[]);
      setWorkOrders(parseInsight(wos).map(r => ({ id: r.id as string, name: r.name as string })));
      setTrips(parseInsight(tripsData).map(r => ({
        id: r.id as string,
        name: `${r.ticketCode || ''} — ${r.name || ''} (${r.company || ''})`.trim()
      })));
      if (selectedWorkOrderId) setSelectedWO(selectedWorkOrderId);
      setLoading(false);
    }).catch(err => { setError(String(err)); setLoading(false); });
  }, [inside, refreshKey]);

  useEffect(() => {
    if (selectedWorkOrderId) setSelectedWO(selectedWorkOrderId);
  }, [selectedWorkOrderId]);

  async function createStockTransaction(item: LineItemRow, type: string, workOrderId?: string, tripId?: string) {
    const now = Math.floor(Date.now() / 1000);
    const fields: Record<string, unknown> = {
      [STF_TYPE]:      type,
      [STF_QTY]:       Number(item.quantityRequired) || 1,
      [STF_DIRECTION]: 'Out',
      [STF_DATE]:      now,
      [STF_NOTES]:     `Auto-created from parts picking — ${item.partNumber || item.name}`,
    };
    if (item.inventoryItem) fields[STF_ITEM] = item.inventoryItem;
    if (item.partNumber)    fields[STF_SKU]  = item.partNumber;
    if (workOrderId)        fields[STF_WO]   = workOrderId;
    if (tripId)             fields[STF_TRIP] = tripId;

    await hailer!.activity.create(STOCK_TXN_WORKFLOW, [{
      name: `${type} — ${item.partNumber || item.name}`,
      phaseId: STOCK_TXN_PHASE,
      fields,
    }], {});
  }

  async function markPicked(item: LineItemRow, context: 'wo' | 'trip') {
    setUpdating(item.id);
    try {
      const workOrderId = context === 'wo' ? selectedWO : undefined;
      const tripId      = context === 'trip' ? selectedTrip : undefined;
      const txnType     = context === 'trip' ? 'Used on Trip' : 'Used in Build';

      // 1. Move line item to Picked
      await hailer!.activity.update([{ _id: item.id, phaseId: PHASE_PICKED }], {});

      // 2. Decrement inventory
      if (item.inventoryItem) {
        const inv = await hailer!.activity.get(item.inventoryItem);
        if (inv) {
          const currentQty = Number((inv.fields as Record<string, unknown>)?.[INV_FIELD_QTY]) || 0;
          const needed     = Number(item.quantityRequired) || 1;
          await hailer!.activity.update([{
            _id: item.inventoryItem,
            fields: { [INV_FIELD_QTY]: Math.max(0, currentQty - needed) },
          }], {});
        }
      }

      // 3. Create stock transaction
      await createStockTransaction(item, txnType, workOrderId, tripId);

      setLineItems(prev => prev.map(l => l.id === item.id ? { ...l, phase: 'Picked' } : l));
      toast({ title: 'Marked as Picked', description: 'Inventory updated & transaction recorded', status: 'success', duration: 2000, isClosable: true });
    } catch (err) {
      toast({ title: 'Error', description: String(err), status: 'error', duration: 4000, isClosable: true });
    }
    setUpdating(null);
  }

  async function markBackordered(item: LineItemRow) {
    setUpdating(item.id);
    try {
      await hailer!.activity.update([{ _id: item.id, phaseId: PHASE_BACKORDERED }], {});
      setLineItems(prev => prev.map(l => l.id === item.id ? { ...l, phase: 'Backordered' } : l));
      toast({ title: 'Marked as Backordered', status: 'warning', duration: 2000, isClosable: true });
    } catch (err) {
      toast({ title: 'Error', description: String(err), status: 'error', duration: 4000, isClosable: true });
    }
    setUpdating(null);
  }

  async function markPending(item: LineItemRow) {
    setUpdating(item.id);
    try {
      await hailer!.activity.update([{ _id: item.id, phaseId: PHASE_PENDING }], {});
      setLineItems(prev => prev.map(l => l.id === item.id ? { ...l, phase: 'Pending' } : l));
      toast({ title: 'Reset to Pending', status: 'info', duration: 2000, isClosable: true });
    } catch (err) {
      toast({ title: 'Error', description: String(err), status: 'error', duration: 4000, isClosable: true });
    }
    setUpdating(null);
  }

  function PartsTable({ items, context }: { items: LineItemRow[]; context: 'wo' | 'trip' }) {
    const pending     = items.filter(l => l.phase === 'Pending').length;
    const backordered = items.filter(l => l.phase === 'Backordered').length;
    const allPicked   = items.length > 0 && pending === 0 && backordered === 0;

    if (items.length === 0) return <Text color="gray.500" mt={4}>No line items. Add parts in the activity.</Text>;

    return (
      <>
        {allPicked && (
          <Alert status="success" borderRadius="md" mb={4}>
            <AlertIcon />
            All parts picked! Stock transactions have been recorded.
          </Alert>
        )}
        <Box overflowX="auto" border="1px" borderColor={borderColor} borderRadius="md">
          <Table variant="simple" size="sm">
            <Thead bg={theadBg}>
              <Tr>
                <Th>Part Number</Th>
                <Th>Description</Th>
                <Th isNumeric>Qty</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {items.map(item => (
                <Tr key={item.id} _hover={{ bg: rowHover }}
                  bg={item.phase === 'Picked' ? greenRow : item.phase === 'Backordered' ? redRow : undefined}>
                  <Td fontWeight="medium" whiteSpace="nowrap">{item.partNumber || '—'}</Td>
                  <Td maxW="280px">
                    <Text noOfLines={2}>{item.description || item.name || '—'}</Text>
                    {item.notes && <Text fontSize="xs" color="gray.500">{item.notes}</Text>}
                  </Td>
                  <Td isNumeric fontWeight="bold">{item.quantityRequired || 1}</Td>
                  <Td><Badge colorScheme={PHASE_COLOR[item.phase] || 'gray'}>{item.phase}</Badge></Td>
                  <Td>
                    <HStack spacing={2}>
                      {item.phase !== 'Picked' && (
                        <Button size="xs" colorScheme="green" isLoading={updating === item.id}
                          onClick={() => markPicked(item, context)}>Pick</Button>
                      )}
                      {item.phase === 'Pending' && (
                        <Button size="xs" colorScheme="red" variant="outline" isLoading={updating === item.id}
                          onClick={() => markBackordered(item)}>Backorder</Button>
                      )}
                      {(item.phase === 'Picked' || item.phase === 'Backordered') && (
                        <Button size="xs" variant="ghost" isLoading={updating === item.id}
                          onClick={() => markPending(item)}>Reset</Button>
                      )}
                    </HStack>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      </>
    );
  }

  if (loading) return <Flex justify="center" align="center" h="300px"><Spinner size="xl" /></Flex>;
  if (error)   return <Text color="red.500">Error: {error}</Text>;

  const woItems   = selectedWO   ? lineItems.filter(l => l.workOrder === selectedWO)   : [];
  const tripItems = selectedTrip ? lineItems.filter(l => l.trip === selectedTrip)      : [];

  return (
    <Box>
      <Tabs variant="soft-rounded" colorScheme="purple">
        <TabList mb={4}>
          <Tab>Work Orders</Tab>
          <Tab>Trips / IHS</Tab>
        </TabList>

        <TabPanels>
          {/* Work Order picking */}
          <TabPanel px={0}>
            <Box bg={cardBg} border="1px" borderColor={borderColor} borderRadius="md" p={4} mb={6}>
              <HStack spacing={4} flexWrap="wrap">
                <VStack align="start" spacing={1}>
                  <Text fontSize="xs" color="gray.500">Work Order</Text>
                  <Select size="sm" minW="300px" value={selectedWO} onChange={e => setSelectedWO(e.target.value)}>
                    <option value="">— Select a Work Order —</option>
                    {workOrders.map(wo => <option key={wo.id} value={wo.id}>{wo.name}</option>)}
                  </Select>
                </VStack>
                {selectedWO && (
                  <HStack spacing={3} mt={4}>
                    <Badge colorScheme="yellow" px={2} py={1}>{woItems.filter(l => l.phase === 'Pending').length} Pending</Badge>
                    <Badge colorScheme="green"  px={2} py={1}>{woItems.filter(l => l.phase === 'Picked').length} Picked</Badge>
                    <Badge colorScheme="red"    px={2} py={1}>{woItems.filter(l => l.phase === 'Backordered').length} Backordered</Badge>
                  </HStack>
                )}
              </HStack>
            </Box>
            {!selectedWO ? (
              <Text color="gray.500">Select a work order to see its parts list.</Text>
            ) : (
              <PartsTable items={woItems} context="wo" />
            )}
          </TabPanel>

          {/* Trip picking */}
          <TabPanel px={0}>
            <Box bg={cardBg} border="1px" borderColor={borderColor} borderRadius="md" p={4} mb={6}>
              <HStack spacing={4} flexWrap="wrap">
                <VStack align="start" spacing={1}>
                  <Text fontSize="xs" color="gray.500">Trip / IHS</Text>
                  <Select size="sm" minW="300px" value={selectedTrip} onChange={e => setSelectedTrip(e.target.value)}>
                    <option value="">— Select a Trip —</option>
                    {trips.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </Select>
                </VStack>
                {selectedTrip && (
                  <HStack spacing={3} mt={4}>
                    <Badge colorScheme="yellow" px={2} py={1}>{tripItems.filter(l => l.phase === 'Pending').length} Pending</Badge>
                    <Badge colorScheme="green"  px={2} py={1}>{tripItems.filter(l => l.phase === 'Picked').length} Picked</Badge>
                    <Badge colorScheme="red"    px={2} py={1}>{tripItems.filter(l => l.phase === 'Backordered').length} Backordered</Badge>
                  </HStack>
                )}
              </HStack>
            </Box>
            {!selectedTrip ? (
              <Text color="gray.500">Select a trip to see its parts list.</Text>
            ) : (
              <PartsTable items={tripItems} context="trip" />
            )}
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
}
