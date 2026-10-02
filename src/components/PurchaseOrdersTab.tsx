import { useEffect, useState } from 'react';
import {
  Badge, Box, Button, Flex, Heading, HStack, Select, SimpleGrid, Spinner,
  Stat, StatLabel, StatNumber, Text, useColorModeValue,
} from '@chakra-ui/react';
import { fetchInsight } from '../hailer/insight-queue';
import { useApp } from '../hailer/use-app';
import NewPurchaseOrderModal from './NewPurchaseOrderModal';
import PurchaseOrderDetailModal from './PurchaseOrderDetailModal';
import {
  PurchaseOrderRow, parseInsight, INSIGHT_PURCHASE_ORDERS,
  PO_PHASE_CANCELLED,
} from './purchaseOrderConstants';

// Custom date fields come back from insights in SECONDS, not milliseconds.
function fmtDate(sec: number | null): string {
  if (!sec) return '—';
  return new Date(sec * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
function fmtEUR(n: number | null): string {
  if (!n) return '—';
  return '€' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const PHASE_COLOR: Record<string, string> = {
  Draft: 'gray', Ordered: 'blue', 'Partially Received': 'orange', Received: 'green', Cancelled: 'red',
};
const ALL_PHASES = ['Draft', 'Ordered', 'Partially Received', 'Received', 'Cancelled'];

interface RefreshProps { refreshKey?: number }

export default function PurchaseOrdersTab({ refreshKey = 0 }: RefreshProps) {
  const { hailer, inside } = useApp();
  const [rows, setRows] = useState<PurchaseOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [phaseFilter, setPhaseFilter] = useState('Active');
  const [localRefresh, setLocalRefresh] = useState(0);
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<PurchaseOrderRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const cardBg = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const mutedText = useColorModeValue('gray.500', 'gray.400');

  function refresh() { setLocalRefresh((k) => k + 1); }

  useEffect(() => {
    if (!inside) return;
    setLoading(true);
    fetchInsight(hailer!, INSIGHT_PURCHASE_ORDERS)
      .then((data) => { setRows(parseInsight<PurchaseOrderRow>(data)); setLoading(false); })
      .catch((err) => { setError(String(err)); setLoading(false); });
  }, [inside, refreshKey, localRefresh]);

  async function cancelOrder(row: PurchaseOrderRow) {
    setBusyId(row.id);
    try {
      await hailer!.activity.update([{ _id: row.id, phaseId: PO_PHASE_CANCELLED }], {});
      refresh();
    } catch {
      // no-op — user can retry
    }
    setBusyId(null);
  }

  const phaseCounts = ALL_PHASES.reduce<Record<string, number>>((acc, p) => {
    acc[p] = rows.filter((r) => r.phase === p).length; return acc;
  }, {});

  const filtered = rows.filter((r) => {
    if (phaseFilter === 'All') return true;
    if (phaseFilter === 'Active') return r.phase === 'Ordered' || r.phase === 'Partially Received' || r.phase === 'Draft';
    return r.phase === phaseFilter;
  });

  if (loading) return <Flex justify="center" align="center" h="300px"><Spinner size="xl" /></Flex>;
  if (error) return <Text color="red.500">Error: {error}</Text>;

  return (
    <Box>
      <Flex justify="space-between" align="center" mb={4} flexWrap="wrap" gap={3}>
        <HStack>
          <Text fontWeight="semibold">Status:</Text>
          <Select size="sm" maxW="220px" value={phaseFilter} onChange={(e) => setPhaseFilter(e.target.value)}>
            <option value="Active">Active (Draft/Ordered/Partial)</option>
            <option value="All">All ({rows.length})</option>
            {ALL_PHASES.map((p) => <option key={p} value={p}>{p} ({phaseCounts[p]})</option>)}
          </Select>
        </HStack>
        <Button size="sm" colorScheme="blue" onClick={() => setShowNew(true)}>+ New Purchase Order</Button>
      </Flex>

      {filtered.length === 0 ? (
        <Text color="gray.500">No purchase orders found.</Text>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={4}>
          {filtered.map((r) => (
            <Box key={r.id} bg={cardBg} border="1px" borderColor={borderColor}
              borderTop="4px solid" borderTopColor={`${PHASE_COLOR[r.phase] || 'gray'}.400`}
              borderRadius="md" shadow="sm" cursor="pointer" onClick={() => setSelected(r)}>
              <Box px={4} pt={4} pb={3} borderBottom="1px" borderColor={borderColor}>
                <Badge colorScheme={PHASE_COLOR[r.phase] || 'gray'} fontSize="xs" mb={1}>{r.phase}</Badge>
                <Heading size="sm" noOfLines={1}>{r.supplier}</Heading>
                {r.orderReference && <Text fontSize="xs" color={mutedText}>#{r.orderReference}</Text>}
              </Box>
              <Box px={4} py={3}>
                <SimpleGrid columns={2} spacing={2} mb={2}>
                  <Box><Text fontSize="xs" color={mutedText}>Order Date</Text><Text fontSize="sm" fontWeight="medium">{fmtDate(r.orderDate)}</Text></Box>
                  <Box><Text fontSize="xs" color={mutedText}>Expected</Text><Text fontSize="sm" fontWeight="medium">{fmtDate(r.expectedDeliveryDate)}</Text></Box>
                </SimpleGrid>
                <SimpleGrid columns={2} spacing={2} mb={3}>
                  <Stat size="sm">
                    <StatLabel fontSize="xs">Ordered / Received</StatLabel>
                    <StatNumber fontSize="md">{r.totalQtyOrdered || 0} / {r.totalQtyReceived || 0}</StatNumber>
                  </Stat>
                  <Stat size="sm">
                    <StatLabel fontSize="xs">Value</StatLabel>
                    <StatNumber fontSize="md">{fmtEUR(r.totalOrderValue)}</StatNumber>
                  </Stat>
                </SimpleGrid>
                <HStack spacing={2} onClick={(e) => e.stopPropagation()}>
                  <Button size="xs" colorScheme="purple" onClick={() => setSelected(r)}>
                    {r.phase === 'Received' ? 'View' : 'Receive'}
                  </Button>
                  <Button size="xs" variant="outline" onClick={() => hailer!.ui.activity.open(r.id)}>Open</Button>
                  {(r.phase === 'Draft' || r.phase === 'Ordered') && (
                    <Button size="xs" variant="ghost" colorScheme="red" isLoading={busyId === r.id}
                      onClick={() => cancelOrder(r)}>Cancel</Button>
                  )}
                </HStack>
              </Box>
            </Box>
          ))}
        </SimpleGrid>
      )}

      <NewPurchaseOrderModal isOpen={showNew} onClose={() => setShowNew(false)} onSuccess={refresh} />
      <PurchaseOrderDetailModal order={selected} onClose={() => setSelected(null)} onChanged={refresh} />
    </Box>
  );
}
