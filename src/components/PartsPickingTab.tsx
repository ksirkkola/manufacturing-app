import {
  Accordion, AccordionButton, AccordionIcon, AccordionItem, AccordionPanel,
  Box, Badge, Button, Center, Flex, Heading, HStack, Icon, Image, Select, Spinner,
  Table, Tbody, Td, Text, Th, Thead, Tr, useColorModeValue,
  useToast, VStack, Alert, AlertIcon, Tabs, TabList, Tab, TabPanels, TabPanel,
} from '@chakra-ui/react';
import { Fragment, useEffect, useState } from 'react';
import { fetchInsights } from '../hailer/insight-queue';
import { useApp } from '../hailer/use-app';
import { HailerDocImage } from '../hailer/theme/icons/HailerDocImage';
import NewOnlineOrderModal from './NewOnlineOrderModal';
import AddOrderLineModal from './AddOrderLineModal';
import OnlineOrderDetailsCard from './OnlineOrderDetailsCard';

// File-modifier fields store a JSON-stringified array of file IDs.
function firstFileId(raw: unknown): string | undefined {
  if (!raw) return undefined;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) return parsed[0];
  } catch {
    if (typeof raw === 'string') return raw;
  }
  return undefined;
}

function imageUrl(fileId: string): string {
  return `https://api.hailer.com/image/thumb/${fileId}`;
}

const INSIGHT_LINE_ITEMS   = '6a4dddd2fd36d690158cc19b';
const INSIGHT_WORK_ORDERS  = '6a4ddad5d9b751c8857618a6';
const INSIGHT_TRIPS        = '6a4dec164d698d6a7fd73078';
const INSIGHT_ONLINE_ORDERS = '6abd8b4529b00ac74d9065c1';

// Line Item phase IDs
const PHASE_PENDING     = '6a4c9c94a218e0e0d33d27b4';
const PHASE_PICKED      = '6a4c9c96a218e0e0d33d27e2';
const PHASE_BACKORDERED = '6a4c9c98a218e0e0d33d2825';

// Online Order (header) phase IDs
const ONLINE_ORDER_PHASE_PENDING     = '6abd8a83d21d6cf791caf702';
const ONLINE_ORDER_PHASE_PICKED      = '6abd8a9b29b00ac74d904f95';
const ONLINE_ORDER_PHASE_BACKORDERED = '6abd8a9d29b00ac74d904fc4';
const ONLINE_ORDER_PHASE_FULFILLED   = '6abd8aa029b00ac74d904ff2';

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
  onlineOrder: string | null;
  inventoryItem: string | null;
  partNumber: string | null;
  description: string | null;
  quantityRequired: number | null;
  quantityPicked: number | null;
  unitCost: number | null;
  notes: string | null;
  transactionType: string | null;
  invPhoto: string | null;
  invBinLocation: string | null;
}

interface Option { id: string; name: string; }
interface TripOption { id: string; name: string; ticketCode: string | null; company: string | null; phase: string; }
interface OnlineOrderOption {
  id: string; name: string; phase: string; orderNumber: string | null;
  orderDate: number | null; customerName: string | null;
  clientCompanyName: string | null; destinationCountry: string | null;
  shippedDate: number | null;
}

// Custom date fields come back from insights in SECONDS, not milliseconds.
function fmtOrderDate(sec: number | null): string {
  if (!sec) return '—';
  return new Date(sec * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

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
const ONLINE_ORDER_PHASE_COLOR: Record<string, string> = {
  Pending: 'yellow', Picked: 'blue', Backordered: 'red', Fulfilled: 'green',
};
const TRIP_PHASE_COLOR: Record<string, string> = {
  'Triage from Support Tickets': 'blue', 'Pre-Travel Activities': 'cyan', 'In Progress': 'green',
  'Follow-Up Activities': 'purple', 'Waiting on PO': 'yellow', 'Waiting on Dates': 'orange',
};
const ONLINE_ORDER_PHASE_RANK: Record<string, number> = {
  Backordered: 0, Pending: 1, Picked: 2, Fulfilled: 3,
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
  const [trips, setTrips]           = useState<TripOption[]>([]);
  const [onlineOrders, setOnlineOrders] = useState<OnlineOrderOption[]>([]);
  const [selectedWO, setSelectedWO] = useState(selectedWorkOrderId || '');
  const [expandedTrips, setExpandedTrips] = useState<Set<string>>(new Set());
  const [selectedOnlineOrder, setSelectedOnlineOrder] = useState('');
  // Sub-tab order: Online Orders, Trips / IHS, Work Orders — Work Orders is last, so jump to
  // index 2 when arriving here via "Pick Parts" from the Work Orders tab.
  const [innerTabIndex, setInnerTabIndex] = useState(0);
  const [loading, setLoading]       = useState(true);
  const [updating, setUpdating]     = useState<string | null>(null);
  const [shippingOrder, setShippingOrder] = useState(false);
  const [showNewOnlineOrder, setShowNewOnlineOrder] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [localRefresh, setLocalRefresh] = useState(0);
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
    fetchInsights(hailer!, [INSIGHT_LINE_ITEMS, INSIGHT_WORK_ORDERS, INSIGHT_TRIPS, INSIGHT_ONLINE_ORDERS])
    .then(([items, wos, tripsData, onlineData]) => {
      setLineItems(parseInsight(items) as unknown as LineItemRow[]);
      setWorkOrders(parseInsight(wos).map(r => ({ id: r.id as string, name: r.name as string })));
      setTrips(parseInsight(tripsData).map(r => ({
        id: r.id as string,
        name: (r.name as string) || '',
        ticketCode: (r.ticketCode as string) || null,
        company: (r.company as string) || null,
        phase: ((r.phase as string) || '').trim(),
      })));
      setOnlineOrders(parseInsight(onlineData).map(r => ({
        id: r.id as string,
        name: (r.name as string) || `Order #${r.orderNumber || ''}`,
        phase: r.phase as string,
        orderNumber: (r.orderNumber as string) || null,
        orderDate: (r.orderDate as number) || null,
        customerName: (r.customerName as string) || null,
        clientCompanyName: (r.clientCompanyName as string) || null,
        destinationCountry: (r.destinationCountry as string) || null,
        shippedDate: (r.shippedDate as number) || null,
      })));
      if (selectedWorkOrderId) { setSelectedWO(selectedWorkOrderId); setInnerTabIndex(2); }
      setLoading(false);
    }).catch(err => { setError(String(err)); setLoading(false); });
  }, [inside, refreshKey, localRefresh]);

  useEffect(() => {
    if (selectedWorkOrderId) { setSelectedWO(selectedWorkOrderId); setInnerTabIndex(2); }
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

  // Online Order header's phase mirrors the aggregate of its line items — recompute and push it
  // after every pick/backorder/reset action on one of its lines. `nextLineItems` is the
  // already-updated array so this reflects the change that just happened, not stale state.
  async function syncOnlineOrderPhase(orderId: string, nextLineItems: LineItemRow[]) {
    const lines = nextLineItems.filter(l => l.onlineOrder === orderId);
    if (lines.length === 0) return;
    const hasBackordered = lines.some(l => l.phase === 'Backordered');
    const hasPending     = lines.some(l => l.phase === 'Pending');
    const targetPhaseId  = hasBackordered ? ONLINE_ORDER_PHASE_BACKORDERED
                          : hasPending     ? ONLINE_ORDER_PHASE_PENDING
                          : ONLINE_ORDER_PHASE_PICKED;
    const targetPhaseName = hasBackordered ? 'Backordered' : hasPending ? 'Pending' : 'Picked';

    const current = onlineOrders.find(o => o.id === orderId);
    if (current?.phase === targetPhaseName) return; // no-op, already in sync

    try {
      await hailer!.activity.update([{ _id: orderId, phaseId: targetPhaseId }], {});
      setOnlineOrders(prev => prev.map(o => o.id === orderId ? { ...o, phase: targetPhaseName } : o));
    } catch {
      // Non-fatal — the line item itself already saved; the order header can be corrected manually.
    }
  }

  async function markPicked(item: LineItemRow, context: 'wo' | 'trip' | 'online') {
    setUpdating(item.id);
    try {
      const workOrderId = context === 'wo'     ? selectedWO    : undefined;
      const tripId       = context === 'trip'   ? (item.trip || undefined) : undefined;
      const txnType      = context === 'trip'   ? 'Used on Trip'
                          : context === 'online' ? 'Sold (Online)'
                          : 'Used in Build';

      // 1. Move line item to Picked
      await hailer!.activity.update([{ _id: item.id, phaseId: PHASE_PICKED }], {});

      // 2. Decrement inventory — allowed to go negative on purpose: a negative Quantity on Hand
      // is the visible "we sold more than we had" signal the Reorder Needed flag watches for.
      // Clamping to 0 here would silently hide an oversell instead of surfacing it.
      if (item.inventoryItem) {
        const inv = await hailer!.activity.get(item.inventoryItem);
        if (inv) {
          const currentQty = Number((inv.fields as Record<string, unknown>)?.[INV_FIELD_QTY]) || 0;
          const needed     = Number(item.quantityRequired) || 1;
          await hailer!.activity.update([{
            _id: item.inventoryItem,
            fields: { [INV_FIELD_QTY]: currentQty - needed },
          }], {});
        }
      }

      // 3. Create stock transaction
      await createStockTransaction(item, txnType, workOrderId, tripId);

      const next = lineItems.map(l => l.id === item.id ? { ...l, phase: 'Picked' } : l);
      setLineItems(next);
      if (context === 'online' && item.onlineOrder) await syncOnlineOrderPhase(item.onlineOrder, next);
      toast({ title: 'Marked as Picked', description: 'Inventory updated & transaction recorded', status: 'success', duration: 2000, isClosable: true });
    } catch (err) {
      toast({ title: 'Error', description: String(err), status: 'error', duration: 4000, isClosable: true });
    }
    setUpdating(null);
  }

  async function markBackordered(item: LineItemRow, context: 'wo' | 'trip' | 'online') {
    setUpdating(item.id);
    try {
      await hailer!.activity.update([{ _id: item.id, phaseId: PHASE_BACKORDERED }], {});
      const next = lineItems.map(l => l.id === item.id ? { ...l, phase: 'Backordered' } : l);
      setLineItems(next);
      if (context === 'online' && item.onlineOrder) await syncOnlineOrderPhase(item.onlineOrder, next);
      toast({ title: 'Marked as Backordered', status: 'warning', duration: 2000, isClosable: true });
    } catch (err) {
      toast({ title: 'Error', description: String(err), status: 'error', duration: 4000, isClosable: true });
    }
    setUpdating(null);
  }

  async function markPending(item: LineItemRow, context: 'wo' | 'trip' | 'online') {
    setUpdating(item.id);
    try {
      await hailer!.activity.update([{ _id: item.id, phaseId: PHASE_PENDING }], {});
      const next = lineItems.map(l => l.id === item.id ? { ...l, phase: 'Pending' } : l);
      setLineItems(next);
      if (context === 'online' && item.onlineOrder) await syncOnlineOrderPhase(item.onlineOrder, next);
      toast({ title: 'Reset to Pending', status: 'info', duration: 2000, isClosable: true });
    } catch (err) {
      toast({ title: 'Error', description: String(err), status: 'error', duration: 4000, isClosable: true });
    }
    setUpdating(null);
  }

  // Manual final step for an online order — click once everything is picked and the box has
  // actually shipped. Deliberately not automatic: "Picked" (stock reserved) and "Fulfilled"
  // (physically packed and out the door) are different facts, and only a person knows the second one.
  async function markOrderFulfilled(orderId: string) {
    setShippingOrder(true);
    try {
      await hailer!.activity.update([{ _id: orderId, phaseId: ONLINE_ORDER_PHASE_FULFILLED }], {});
      setOnlineOrders(prev => prev.map(o => o.id === orderId ? { ...o, phase: 'Fulfilled' } : o));
      toast({ title: 'Order marked Fulfilled', status: 'success', duration: 2500, isClosable: true });
    } catch (err) {
      toast({ title: 'Error', description: String(err), status: 'error', duration: 4000, isClosable: true });
    }
    setShippingOrder(false);
  }

  function PartsTable({ items, context }: { items: LineItemRow[]; context: 'wo' | 'trip' | 'online' }) {
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
                <Th>Photo</Th>
                <Th>Part Number</Th>
                <Th>Bin</Th>
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
                  <Td>
                    {(() => {
                      const fileId = firstFileId(item.invPhoto);
                      return fileId ? (
                        <Image src={imageUrl(fileId)} alt={item.partNumber || item.name} boxSize="40px" objectFit="contain" borderRadius="md" />
                      ) : (
                        <Center boxSize="40px" bg={theadBg} borderRadius="md">
                          <Icon as={HailerDocImage} boxSize={4} color="gray.300" />
                        </Center>
                      );
                    })()}
                  </Td>
                  <Td fontWeight="medium" whiteSpace="nowrap">{item.partNumber || '—'}</Td>
                  <Td whiteSpace="nowrap">
                    {item.invBinLocation ? (
                      <Badge colorScheme="blue" fontSize="xs">{item.invBinLocation}</Badge>
                    ) : '—'}
                  </Td>
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
                          onClick={() => markBackordered(item, context)}>Backorder</Button>
                      )}
                      {(item.phase === 'Picked' || item.phase === 'Backordered') && (
                        <Button size="xs" variant="ghost" isLoading={updating === item.id}
                          onClick={() => markPending(item, context)}>Reset</Button>
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

  const woItems     = selectedWO           ? lineItems.filter(l => l.workOrder === selectedWO)           : [];
  const onlineItems = selectedOnlineOrder  ? lineItems.filter(l => l.onlineOrder === selectedOnlineOrder) : [];
  // Closed trips are done — nothing left to pick, so they're not listed at all.
  const openTrips = trips.filter(t => t.phase !== 'Closed');
  const backorderedOnlineCount = lineItems.filter(l => l.onlineOrder && l.phase === 'Backordered').length;
  const selectedOnlineOrderData = onlineOrders.find(o => o.id === selectedOnlineOrder);
  const canMarkFulfilled = !!selectedOnlineOrderData
    && selectedOnlineOrderData.phase === 'Picked'
    && onlineItems.length > 0;
  const openOnlineOrders = onlineOrders
    .filter(o => o.phase !== 'Fulfilled')
    .sort((a, b) => (ONLINE_ORDER_PHASE_RANK[a.phase] ?? 9) - (ONLINE_ORDER_PHASE_RANK[b.phase] ?? 9));
  const closedOnlineOrders = onlineOrders
    .filter(o => o.phase === 'Fulfilled')
    .sort((a, b) => (b.shippedDate ?? b.orderDate ?? 0) - (a.shippedDate ?? a.orderDate ?? 0));

  function toggleTrip(id: string) {
    setExpandedTrips(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // One table row per trip (same look as the Online Orders list); clicking a row expands its
  // parts list inline underneath, so several trips can be open at once.
  function renderTripRow(t: TripOption) {
    const items       = lineItems.filter(l => l.trip === t.id);
    const pending     = items.filter(l => l.phase === 'Pending').length;
    const picked      = items.filter(l => l.phase === 'Picked').length;
    const backordered = items.filter(l => l.phase === 'Backordered').length;
    const open        = expandedTrips.has(t.id);
    return (
      <Fragment key={t.id}>
        <Tr
          cursor="pointer"
          bg={open ? greenRow : backordered > 0 ? redRow : undefined}
          _hover={{ bg: rowHover }}
          onClick={() => toggleTrip(t.id)}
        >
          <Td w="1%" px={2}>{open ? '▾' : '▸'}</Td>
          <Td fontWeight="medium" whiteSpace="nowrap">{t.ticketCode || '—'}</Td>
          <Td>{t.name || '—'}</Td>
          <Td>{t.company || '—'}</Td>
          <Td><Badge colorScheme={TRIP_PHASE_COLOR[t.phase] || 'gray'}>{t.phase || '—'}</Badge></Td>
          <Td>
            {items.length === 0 ? (
              <Text fontSize="xs" color="gray.400">No parts</Text>
            ) : (
              <HStack spacing={2}>
                {pending > 0     && <Badge colorScheme="yellow">{pending} Pending</Badge>}
                {picked > 0      && <Badge colorScheme="green">{picked} Picked</Badge>}
                {backordered > 0 && <Badge colorScheme="red">{backordered} Backordered</Badge>}
              </HStack>
            )}
          </Td>
        </Tr>
        {open && (
          <Tr>
            <Td colSpan={6} p={4} borderBottom="1px" borderColor={borderColor}>
              <PartsTable items={items} context="trip" />
            </Td>
          </Tr>
        )}
      </Fragment>
    );
  }

  return (
    <Box>
      <Tabs variant="soft-rounded" colorScheme="purple" index={innerTabIndex} onChange={setInnerTabIndex}>
        <TabList mb={4}>
          <Tab>
            Online Orders
            {backorderedOnlineCount > 0 && (
              <Badge ml={2} colorScheme="red" fontSize="xs">
                {backorderedOnlineCount}
              </Badge>
            )}
          </Tab>
          <Tab>Trips / IHS</Tab>
          <Tab>Work Orders</Tab>
        </TabList>

        <TabPanels>
          {/* Online (BigCommerce) orders — created by the Zapier automation as an Online Order
              header + Work Order Line Item(s), same Pending/Picked/Backordered flow as Work
              Orders and Trips. Picking here decrements inventory and logs a Stock Transaction
              exactly like the other two contexts — the automation no longer touches stock
              directly, so there's one trusted place inventory actually changes. */}
          <TabPanel px={0}>
            <HStack justify="space-between" mb={3}>
              <Text fontSize="sm" color="gray.500">{openOnlineOrders.length} open order{openOnlineOrders.length === 1 ? '' : 's'}</Text>
              <Button size="sm" colorScheme="blue" onClick={() => setShowNewOnlineOrder(true)}>⬆ Upload Order</Button>
            </HStack>

            {openOnlineOrders.length === 0 ? (
              <Text color="gray.500" mb={6}>No open online orders.</Text>
            ) : (
              <Box overflowX="auto" border="1px" borderColor={borderColor} borderRadius="md" mb={6}>
                <Table variant="simple" size="sm">
                  <Thead bg={theadBg}>
                    <Tr>
                      <Th>Order #</Th>
                      <Th>Client</Th>
                      <Th>Destination</Th>
                      <Th>Order Date</Th>
                      <Th>Status</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {openOnlineOrders.map(o => (
                      <Tr
                        key={o.id} cursor="pointer"
                        bg={selectedOnlineOrder === o.id ? greenRow : o.phase === 'Backordered' ? redRow : undefined}
                        _hover={{ bg: rowHover }}
                        onClick={() => setSelectedOnlineOrder(o.id)}
                      >
                        <Td fontWeight="medium">{o.orderNumber ? `#${o.orderNumber}` : o.name}</Td>
                        <Td>
                          <Text>{o.clientCompanyName || '—'}</Text>
                          {o.customerName && <Text fontSize="xs" color="gray.500">{o.customerName}</Text>}
                        </Td>
                        <Td>{o.destinationCountry || '—'}</Td>
                        <Td whiteSpace="nowrap">{fmtOrderDate(o.orderDate)}</Td>
                        <Td><Badge colorScheme={ONLINE_ORDER_PHASE_COLOR[o.phase] || 'gray'}>{o.phase}</Badge></Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </Box>
            )}

            {/* Fulfilled orders are done — tucked away by default so they don't crowd the
                working list above. Still fully browsable, with the shipped date visible. */}
            <Accordion allowToggle mb={6}>
              <AccordionItem border="1px" borderColor={borderColor} borderRadius="md">
                <AccordionButton>
                  <Box flex="1" textAlign="left" fontSize="sm" fontWeight="medium">
                    Closed Orders ({closedOnlineOrders.length})
                  </Box>
                  <AccordionIcon />
                </AccordionButton>
                <AccordionPanel pb={2} px={0}>
                  {closedOnlineOrders.length === 0 ? (
                    <Text color="gray.500" px={4} pb={2}>No fulfilled orders yet.</Text>
                  ) : (
                    <Box overflowX="auto">
                      <Table variant="simple" size="sm">
                        <Thead bg={theadBg}>
                          <Tr>
                            <Th>Order #</Th>
                            <Th>Client</Th>
                            <Th>Destination</Th>
                            <Th>Order Date</Th>
                            <Th>Shipped</Th>
                            <Th>Status</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {closedOnlineOrders.map(o => (
                            <Tr
                              key={o.id} cursor="pointer"
                              bg={selectedOnlineOrder === o.id ? greenRow : undefined}
                              _hover={{ bg: rowHover }}
                              onClick={() => setSelectedOnlineOrder(o.id)}
                            >
                              <Td fontWeight="medium">{o.orderNumber ? `#${o.orderNumber}` : o.name}</Td>
                              <Td>
                                <Text>{o.clientCompanyName || '—'}</Text>
                                {o.customerName && <Text fontSize="xs" color="gray.500">{o.customerName}</Text>}
                              </Td>
                              <Td>{o.destinationCountry || '—'}</Td>
                              <Td whiteSpace="nowrap">{fmtOrderDate(o.orderDate)}</Td>
                              <Td whiteSpace="nowrap">{fmtOrderDate(o.shippedDate)}</Td>
                              <Td><Badge colorScheme={ONLINE_ORDER_PHASE_COLOR[o.phase] || 'gray'}>{o.phase}</Badge></Td>
                            </Tr>
                          ))}
                        </Tbody>
                      </Table>
                    </Box>
                  )}
                </AccordionPanel>
              </AccordionItem>
            </Accordion>

            {selectedOnlineOrder && (
              <Box border="1px" borderColor={borderColor} borderRadius="md" p={4} mb={6}>
                <HStack spacing={3} flexWrap="wrap">
                  <Badge colorScheme="yellow" px={2} py={1}>{onlineItems.filter(l => l.phase === 'Pending').length} Pending</Badge>
                  <Badge colorScheme="green"  px={2} py={1}>{onlineItems.filter(l => l.phase === 'Picked').length} Picked</Badge>
                  <Badge colorScheme="red"    px={2} py={1}>{onlineItems.filter(l => l.phase === 'Backordered').length} Backordered</Badge>
                  <Button size="xs" variant="outline" onClick={() => setShowAddItem(true)}>+ Add Item</Button>
                  <Button
                    size="xs" colorScheme="blue" isLoading={shippingOrder}
                    isDisabled={!canMarkFulfilled}
                    onClick={() => markOrderFulfilled(selectedOnlineOrder)}
                  >
                    {selectedOnlineOrderData?.phase === 'Fulfilled' ? 'Fulfilled ✓' : 'Mark Order Fulfilled'}
                  </Button>
                </HStack>
              </Box>
            )}

            {selectedOnlineOrder && (
              <>
                <OnlineOrderDetailsCard
                  orderId={selectedOnlineOrder}
                  orderName={selectedOnlineOrderData?.name || 'Order'}
                  onChanged={() => setLocalRefresh(k => k + 1)}
                />
                <PartsTable items={onlineItems} context="online" />
              </>
            )}
          </TabPanel>

          {/* Trip picking — open trips only (closed ones have nothing left to pick). Same
              list style as Online Orders; click a trip to expand its parts. */}
          <TabPanel px={0}>
            <HStack justify="space-between" mb={3}>
              <Text fontSize="sm" color="gray.500">{openTrips.length} open trip{openTrips.length === 1 ? '' : 's'}</Text>
            </HStack>

            {openTrips.length === 0 ? (
              <Text color="gray.500" mb={6}>No open trips.</Text>
            ) : (
              <Box overflowX="auto" border="1px" borderColor={borderColor} borderRadius="md" mb={6}>
                <Table variant="simple" size="sm">
                  <Thead bg={theadBg}>
                    <Tr>
                      <Th w="1%"></Th>
                      <Th>Code</Th>
                      <Th>Trip</Th>
                      <Th>Company</Th>
                      <Th>Status</Th>
                      <Th>Parts</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {openTrips.map(renderTripRow)}
                  </Tbody>
                </Table>
              </Box>
            )}
          </TabPanel>

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
        </TabPanels>
      </Tabs>

      <NewOnlineOrderModal
        isOpen={showNewOnlineOrder}
        onClose={() => setShowNewOnlineOrder(false)}
        onSuccess={() => setLocalRefresh(k => k + 1)}
      />
      {selectedOnlineOrder && (
        <AddOrderLineModal
          isOpen={showAddItem}
          onClose={() => setShowAddItem(false)}
          orderId={selectedOnlineOrder}
          orderName={selectedOnlineOrderData?.name || 'Order'}
          onAdded={() => setLocalRefresh(k => k + 1)}
        />
      )}
    </Box>
  );
}
