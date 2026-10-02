import {
  Badge, Box, Flex, Heading, SimpleGrid, Spinner, Stat, StatLabel, StatNumber, Table, Tbody,
  Td, Text, Th, Thead, Tr, useColorModeValue,
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { fetchInsights } from '../hailer/insight-queue';
import { useApp } from '../hailer/use-app';
import { INSIGHT_INVENTORY, INSIGHT_PURCHASE_ORDERS } from './purchaseOrderConstants';
import { INSIGHT_SENSOR_UNITS } from './sensorConstants';

const INSIGHT_WORK_ORDERS   = '6a4ddad5d9b751c8857618a6'; // already filtered to phase NOT IN ('Complete')
const INSIGHT_ONLINE_ORDERS = '6abd8b4529b00ac74d9065c1';
const INSIGHT_LINE_ITEMS    = '6a4dddd2fd36d690158cc19b'; // already filtered to phase NOT IN ('Not Required')

interface InventoryRow {
  id: string; quantityOnHand: number | null; minimumStock: number | null;
}
interface PORow {
  id: string; name: string; phase: string;
  supplier: string | null; orderReference: string | null;
  orderDate: number | null; expectedDeliveryDate: number | null;
  totalOrderValue: number | null;
}
interface WORow { id: string; phase: string; }
interface OnlineOrderRow {
  id: string; name: string; phase: string;
  orderNumber: string | null; orderDate: number | null; customerName: string | null;
  clientCompanyName: string | null; destinationCountry: string | null;
}
interface SensorRow {
  id: string; name: string; phase: string;
  sensorType: string | null; serialNumber: string | null;
  calibrationDate: number | null; assignedToName: string | null;
}
interface LineItemRow { id: string; phase: string; }

const SENSOR_ATTENTION_PHASES = ['Needs Repair', 'Out for Recalibration', 'Needs Calibration'];
const SENSOR_PHASE_RANK: Record<string, number> = { 'Needs Repair': 0, 'Out for Recalibration': 1, 'Needs Calibration': 2 };
const SENSOR_PHASE_COLOR: Record<string, string> = { 'Needs Repair': 'red', 'Out for Recalibration': 'orange', 'Needs Calibration': 'yellow' };

const ONLINE_ORDER_PHASE_RANK: Record<string, number> = { Backordered: 0, Pending: 1, Picked: 2 };
const ONLINE_ORDER_PHASE_COLOR: Record<string, string> = { Backordered: 'red', Pending: 'yellow', Picked: 'blue' };

const PO_OPEN_PHASES = ['Draft', 'Ordered', 'Partially Received'];
const PO_PHASE_RANK: Record<string, number> = { 'Partially Received': 0, Ordered: 1, Draft: 2 };
const PO_PHASE_COLOR: Record<string, string> = { 'Partially Received': 'orange', Ordered: 'blue', Draft: 'gray' };

function parseInsight(data: { headers: string[]; rows: unknown[][] }): Record<string, unknown>[] {
  return data.rows.map(row => {
    const r: Record<string, unknown> = {};
    data.headers.forEach((h, i) => { r[h] = row[i]; });
    return r;
  });
}

// Custom date fields come back from insights in SECONDS, not milliseconds.
function fmtDate(sec: number | null): string {
  if (!sec) return '—';
  return new Date(sec * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface KpiCardProps {
  label: string; value: number; helpText: string; color: string; onClick: () => void;
}
function KpiCard({ label, value, helpText, color, onClick }: KpiCardProps) {
  const cardBg = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  return (
    <Box
      p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor}
      borderTop="3px solid" borderTopColor={`${color}.400`} cursor="pointer"
      transition="all 0.15s ease" _hover={{ shadow: 'md', transform: 'translateY(-2px)' }}
      onClick={onClick}
    >
      <Stat>
        <StatLabel>{label}</StatLabel>
        <StatNumber color={value > 0 ? `${color}.500` : undefined}>{value}</StatNumber>
        <Text fontSize="xs" color="gray.500">{helpText}</Text>
      </Stat>
    </Box>
  );
}

interface Props {
  refreshKey?: number;
  onNavigate: (tabIndex: number) => void;
}

// Tab indices this Overview links out to — kept in one place so a future tab reorder
// only needs updating here, not scattered through JSX below. Order: Reference, Overview,
// Inventory, Sensors, Parts Picking, Purchase Orders, Work Orders, Stock History.
const TAB = { INVENTORY: 2, SENSORS: 3, PARTS_PICKING: 4, PURCHASE_ORDERS: 5, WORK_ORDERS: 6 };

export default function OverviewTab({ refreshKey = 0, onNavigate }: Props) {
  const { hailer, inside } = useApp();
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PORow[]>([]);
  const [workOrders, setWorkOrders] = useState<WORow[]>([]);
  const [onlineOrders, setOnlineOrders] = useState<OnlineOrderRow[]>([]);
  const [sensors, setSensors] = useState<SensorRow[]>([]);
  const [lineItems, setLineItems] = useState<LineItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const theadBg = useColorModeValue('gray.50', 'gray.800');
  const rowHover = useColorModeValue('gray.50', 'gray.600');

  useEffect(() => {
    if (!inside) return;
    setLoading(true);
    fetchInsights(hailer!, [
      INSIGHT_INVENTORY, INSIGHT_PURCHASE_ORDERS, INSIGHT_WORK_ORDERS,
      INSIGHT_ONLINE_ORDERS, INSIGHT_SENSOR_UNITS, INSIGHT_LINE_ITEMS,
    ]).then(([inv, po, wo, online, sens, items]) => {
      setInventory(parseInsight(inv) as unknown as InventoryRow[]);
      setPurchaseOrders(parseInsight(po) as unknown as PORow[]);
      setWorkOrders(parseInsight(wo) as unknown as WORow[]);
      setOnlineOrders(parseInsight(online) as unknown as OnlineOrderRow[]);
      setSensors(parseInsight(sens) as unknown as SensorRow[]);
      setLineItems(parseInsight(items) as unknown as LineItemRow[]);
      setLoading(false);
    }).catch(err => { setError(String(err)); setLoading(false); });
  }, [inside, refreshKey]);

  if (loading) return <Flex justify="center" align="center" h="300px"><Spinner size="xl" /></Flex>;
  if (error)   return <Text color="red.500">Error: {error}</Text>;

  const reorderNeeded = inventory.filter(i => (i.minimumStock || 0) > 0 && (i.quantityOnHand ?? 0) <= (i.minimumStock || 0));
  const outOfStock = inventory.filter(i => (i.quantityOnHand ?? 0) <= 0);
  const sensorsNeedingAttention = sensors.filter(s => SENSOR_ATTENTION_PHASES.includes(s.phase));
  const sensorBreakdown = SENSOR_ATTENTION_PHASES
    .map(phase => ({ phase, count: sensorsNeedingAttention.filter(s => s.phase === phase).length }))
    .filter(b => b.count > 0);
  const sensorHelpText = sensorBreakdown.length > 0
    ? sensorBreakdown.map(b => `${b.count} ${b.phase.replace('Needs ', '').replace('Out for ', '')}`).join(' · ')
    : 'None needing calibration or repair';
  const sensorsSorted = sensorsNeedingAttention
    .sort((a, b) => (SENSOR_PHASE_RANK[a.phase] ?? 9) - (SENSOR_PHASE_RANK[b.phase] ?? 9));

  const openPicking = lineItems.filter(l => l.phase === 'Pending' || l.phase === 'Backordered');
  const openPickingBackordered = openPicking.filter(l => l.phase === 'Backordered').length;

  const openOnlineOrders = onlineOrders
    .filter(o => o.phase !== 'Fulfilled')
    .sort((a, b) => (ONLINE_ORDER_PHASE_RANK[a.phase] ?? 9) - (ONLINE_ORDER_PHASE_RANK[b.phase] ?? 9));

  const openPOs = purchaseOrders
    .filter(p => PO_OPEN_PHASES.includes(p.phase))
    .sort((a, b) => (PO_PHASE_RANK[a.phase] ?? 9) - (PO_PHASE_RANK[b.phase] ?? 9));

  return (
    <Box>
      <Heading size="sm" mb={4} color="gray.500">At a Glance</Heading>
      <SimpleGrid columns={{ base: 2, md: 3, lg: 4, xl: 8 }} spacing={4} mb={8}>
        <KpiCard label="Reorder Needed" value={reorderNeeded.length} helpText="Inventory at/below minimum"
          color="orange" onClick={() => onNavigate(TAB.INVENTORY)} />
        <KpiCard label="Out of Stock" value={outOfStock.length} helpText="Qty on hand ≤ 0"
          color="red" onClick={() => onNavigate(TAB.INVENTORY)} />
        <KpiCard label="Open Online Orders" value={openOnlineOrders.length} helpText="Not yet Fulfilled"
          color="cyan" onClick={() => onNavigate(TAB.PARTS_PICKING)} />
        <KpiCard label="Open Parts Picking" value={openPicking.length} helpText="Pending/backordered lines — any context"
          color="yellow" onClick={() => onNavigate(TAB.PARTS_PICKING)} />
        <KpiCard label="Backordered Lines" value={openPickingBackordered} helpText="Waiting on stock, any context"
          color="red" onClick={() => onNavigate(TAB.PARTS_PICKING)} />
        <KpiCard label="Open Work Orders" value={workOrders.length} helpText="Builds/repairs in progress"
          color="purple" onClick={() => onNavigate(TAB.WORK_ORDERS)} />
        <KpiCard label="Active Purchase Orders" value={openPOs.length} helpText="Draft, Ordered, or Partial"
          color="blue" onClick={() => onNavigate(TAB.PURCHASE_ORDERS)} />
        <KpiCard label="Sensors Needing Attention" value={sensorsNeedingAttention.length} helpText={sensorHelpText}
          color="teal" onClick={() => onNavigate(TAB.SENSORS)} />
      </SimpleGrid>

      <HeadingWithCount title="Open Online Orders" count={openOnlineOrders.length} />
      {openOnlineOrders.length === 0 ? (
        <Text color="gray.500" mb={8}>Nothing open — every order has been Fulfilled.</Text>
      ) : (
        <Box overflowX="auto" border="1px" borderColor={borderColor} borderRadius="md" mb={8}>
          <Table variant="simple" size="sm">
            <Thead bg={theadBg}>
              <Tr>
                <Th>Order #</Th>
                <Th>Client</Th>
                <Th>Destination</Th>
                <Th>Date</Th>
                <Th>Status</Th>
              </Tr>
            </Thead>
            <Tbody>
              {openOnlineOrders.map(o => (
                <Tr key={o.id} cursor="pointer" _hover={{ bg: rowHover }} onClick={() => onNavigate(TAB.PARTS_PICKING)}>
                  <Td fontWeight="medium">{o.orderNumber ? `#${o.orderNumber}` : o.name}</Td>
                  <Td>
                    <Text>{o.clientCompanyName || '—'}</Text>
                    {o.customerName && <Text fontSize="xs" color="gray.500">{o.customerName}</Text>}
                  </Td>
                  <Td>{o.destinationCountry || '—'}</Td>
                  <Td whiteSpace="nowrap">{fmtDate(o.orderDate)}</Td>
                  <Td><Badge colorScheme={ONLINE_ORDER_PHASE_COLOR[o.phase] || 'gray'}>{o.phase}</Badge></Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}

      <HeadingWithCount title="Active Purchase Orders" count={openPOs.length} />
      {openPOs.length === 0 ? (
        <Text color="gray.500" mb={8}>Nothing open — no Draft, Ordered, or Partially Received purchase orders.</Text>
      ) : (
        <Box overflowX="auto" border="1px" borderColor={borderColor} borderRadius="md" mb={8}>
          <Table variant="simple" size="sm">
            <Thead bg={theadBg}>
              <Tr>
                <Th>Order #</Th>
                <Th>Supplier</Th>
                <Th>Order Date</Th>
                <Th>Expected Delivery</Th>
                <Th>Status</Th>
              </Tr>
            </Thead>
            <Tbody>
              {openPOs.map(p => (
                <Tr key={p.id} cursor="pointer" _hover={{ bg: rowHover }} onClick={() => onNavigate(TAB.PURCHASE_ORDERS)}>
                  <Td fontWeight="medium">{p.orderReference || p.name}</Td>
                  <Td>{p.supplier || '—'}</Td>
                  <Td whiteSpace="nowrap">{fmtDate(p.orderDate)}</Td>
                  <Td whiteSpace="nowrap">{fmtDate(p.expectedDeliveryDate)}</Td>
                  <Td><Badge colorScheme={PO_PHASE_COLOR[p.phase] || 'gray'}>{p.phase}</Badge></Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}

      <HeadingWithCount title="Sensors Needing Attention" count={sensorsSorted.length} />
      {sensorsSorted.length === 0 ? (
        <Text color="gray.500" mb={2}>Nothing to flag — no sensors need calibration or repair.</Text>
      ) : (
        <Box overflowX="auto" border="1px" borderColor={borderColor} borderRadius="md" mb={2}>
          <Table variant="simple" size="sm">
            <Thead bg={theadBg}>
              <Tr>
                <Th>Sensor</Th>
                <Th>Type</Th>
                <Th>Serial #</Th>
                <Th>Last Calibrated</Th>
                <Th>Assigned To</Th>
                <Th>Status</Th>
              </Tr>
            </Thead>
            <Tbody>
              {sensorsSorted.map(s => (
                <Tr key={s.id} cursor="pointer" _hover={{ bg: rowHover }} onClick={() => onNavigate(TAB.SENSORS)}>
                  <Td fontWeight="medium">{s.name}</Td>
                  <Td>{s.sensorType || '—'}</Td>
                  <Td>{s.serialNumber || '—'}</Td>
                  <Td whiteSpace="nowrap">{fmtDate(s.calibrationDate)}</Td>
                  <Td>{s.assignedToName || '—'}</Td>
                  <Td><Badge colorScheme={SENSOR_PHASE_COLOR[s.phase] || 'gray'}>{s.phase}</Badge></Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}
    </Box>
  );
}

function HeadingWithCount({ title, count }: { title: string; count: number }) {
  return (
    <Heading size="sm" mb={4} color="gray.500">
      {title}{count > 0 ? ` (${count})` : ''}
    </Heading>
  );
}
