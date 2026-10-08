import {
  Box, SimpleGrid, Stat, StatLabel, StatNumber, Badge, Spinner,
  Text, Flex, useColorModeValue, Heading, HStack, Select, Button,
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { fetchInsight } from '../hailer/insight-queue';
import { useApp } from '../hailer/use-app';
import BuildDetailModal from './BuildDetailModal';
import { createActivityViaDialog } from '../hailer/employees';

// All phases, including Complete (the older shared insight 6a4ddad5... is open-only and still feeds Overview).
const INSIGHT_WORK_ORDERS = '6ac76b652c2e4a4f134bba35';
const INSIGHT_BUILD_STATUS = '6ac76918205b3672b29acae1';
const WORK_ORDER_WORKFLOW = '6a4c9c50b7d11c3c37c9ca77';
const WORK_ORDER_PHASE_NEW = '6a4c9c7fa218e0e0d33d25a0';
const WO_FIELD_BUILD_TYPE = '6a4c9ce402e498c78d712857';

interface BuildStatus {
  id: string;
  dateReceived: number | null;
  receivedFrom: string | null;
  assemblyProgress: string | null;
  logEntries: number | null;
  lastLogDate: number | null;
}

interface WorkOrderRow {
  id: string;
  name: string;
  phase: string;
  buildType: string | null;
  productType: string | null;
  serialNumber: string | null;
  customer: string | null;
  assignedTo: string | null;
  priority: string | null;
  targetShipDate: number | null;
  descriptionOfWork: string | null;
}

function fmtDate(val: unknown): string {
  if (!val || isNaN(Number(val))) return '—';
  return new Date(Number(val) * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function parseInsight(data: { headers: string[]; rows: unknown[][] }): WorkOrderRow[] {
  return data.rows.map(row => {
    const r: Record<string, unknown> = {};
    data.headers.forEach((h, i) => { r[h] = row[i]; });
    return r as unknown as WorkOrderRow;
  });
}

const PHASE_COLOR: Record<string, string> = {
  'New': 'blue', 'Kit Received': 'telegram', 'Parts Sourcing': 'yellow', 'Assembly': 'purple',
  'QC / Testing': 'cyan', 'Ready to Ship': 'green', 'Shipped': 'teal', 'On Hold': 'red',
  'Sent Out for Repair': 'orange', 'Complete': 'gray',
};

const PRIORITY_COLOR: Record<string, string> = {
  'Urgent': 'red', 'High': 'orange', 'Normal': 'blue', 'Low': 'gray',
};

const ALL_PHASES = ['New', 'Kit Received', 'Parts Sourcing', 'Assembly', 'QC / Testing', 'Ready to Ship', 'Shipped', 'On Hold', 'Sent Out for Repair'];
// Complete is not a tile (it would be a pile of finished builds); it is only reachable from the dropdown.
const DROPDOWN_PHASES = [...ALL_PHASES, 'Complete'];

interface Props {
  onSelectWorkOrder: (id: string, name: string) => void;
  refreshKey?: number;
}

export default function WorkOrdersTab({ onSelectWorkOrder, refreshKey = 0 }: Props) {
  const { hailer, inside, user } = useApp();
  const [rows, setRows] = useState<WorkOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhase, setSelectedPhase] = useState('All');
  const [status, setStatus] = useState<Record<string, BuildStatus>>({});
  const [buildOpen, setBuildOpen] = useState<{ id: string; name: string } | null>(null);
  const [statusTick, setStatusTick] = useState(0);
  const [reloadTick, setReloadTick] = useState(0);
  const [creating, setCreating] = useState(false);

  const cardBg      = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const labelColor  = useColorModeValue('gray.500', 'gray.400');

  useEffect(() => {
    if (!inside) return;
    setLoading(true);
    fetchInsight(hailer!, INSIGHT_WORK_ORDERS)
      .then(data => { setRows(parseInsight(data)); setLoading(false); })
      .catch(err => { setError(String(err)); setLoading(false); });
  }, [inside, refreshKey, reloadTick]);

  // Build status (received date, checklist progress, daily log) comes from its own insight and is merged by id.
  useEffect(() => {
    if (!inside) return;
    fetchInsight(hailer!, INSIGHT_BUILD_STATUS)
      .then(data => setStatus(Object.fromEntries(parseInsight(data as never).map(r => [(r as unknown as BuildStatus).id, r as unknown as BuildStatus]))))
      .catch(() => { /* status is optional; the cards still render without it */ });
  }, [inside, refreshKey, statusTick, reloadTick]);

  async function newWorkOrder() {
    if (!hailer) return;
    setCreating(true);
    try {
      const created = await createActivityViaDialog(hailer, WORK_ORDER_WORKFLOW, {
        phaseId: WORK_ORDER_PHASE_NEW,
        fields: { [WO_FIELD_BUILD_TYPE]: 'New Build' },
      });
      if (created) {
        hailer.ui.snackbar.open('Work Order created.', 'OK', 3000).catch(() => {});
        setReloadTick(t => t + 1);
      }
    } catch (err) {
      console.error('Create work order failed:', err);
    }
    setCreating(false);
  }

  const filteredRows = selectedPhase === 'All' ? rows : rows.filter(r => r.phase === selectedPhase);
  const phaseCounts = DROPDOWN_PHASES.reduce<Record<string, number>>((acc, p) => {
    acc[p] = rows.filter(r => r.phase === p).length; return acc;
  }, {});

  function userName(id: string | null): string {
    if (!id) return '—';
    const u = user.map[id];
    return u ? `${u.firstname} ${u.lastname}` : id;
  }

  function isOverdue(val: number | null): boolean {
    return !!val && new Date(Number(val) * 1000) < new Date();
  }

  if (loading) return <Flex justify="center" align="center" h="300px"><Spinner size="xl" /></Flex>;
  if (error)   return <Text color="red.500">Error: {error}</Text>;

  return (
    <Box>
      {/* Phase summary */}
      <SimpleGrid columns={{ base: 2, md: 4, lg: 9 }} spacing={3} mb={6}>
        {ALL_PHASES.map(p => (
          <Box key={p} p={3} bg={cardBg} borderRadius="md" shadow="sm"
            border="1px" borderColor={borderColor}
            borderTop="3px solid" borderTopColor={`${PHASE_COLOR[p] || 'gray'}.400`}
            cursor="pointer" onClick={() => setSelectedPhase(selectedPhase === p ? 'All' : p)}
            opacity={selectedPhase !== 'All' && selectedPhase !== p ? 0.5 : 1}>
            <Stat>
              <StatLabel fontSize="xs" noOfLines={2}>{p}</StatLabel>
              <StatNumber>{phaseCounts[p]}</StatNumber>
            </Stat>
          </Box>
        ))}
      </SimpleGrid>

      <Flex align="center" justify="space-between" mb={4}>
        <HStack>
          <Text fontWeight="semibold">Phase:</Text>
          <Select size="sm" maxW="200px" value={selectedPhase} onChange={e => setSelectedPhase(e.target.value)}>
            <option value="All">All ({rows.length})</option>
            {DROPDOWN_PHASES.map(p => <option key={p} value={p}>{p} ({phaseCounts[p]})</option>)}
          </Select>
        </HStack>
        <HStack spacing={4}>
          <Text fontSize="sm" color={labelColor}>{filteredRows.length} work order{filteredRows.length !== 1 ? 's' : ''}</Text>
          <Button size="sm" colorScheme="purple" isLoading={creating} onClick={() => void newWorkOrder()}>+ New Work Order</Button>
        </HStack>
      </Flex>

      {filteredRows.length === 0 ? (
        <Text color="gray.500">No work orders found.</Text>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={4}>
          {filteredRows.map(r => (
            <Box key={r.id} bg={cardBg} border="1px"
              borderColor={isOverdue(r.targetShipDate) && r.phase !== 'Shipped' ? 'red.300' : borderColor}
              borderTop="4px solid" borderTopColor={`${PHASE_COLOR[r.phase] || 'gray'}.400`}
              borderRadius="md" shadow="sm">

              <Box px={4} pt={4} pb={3} borderBottom="1px" borderColor={borderColor}>
                <Flex justify="space-between" align="start" mb={1}>
                  <HStack spacing={2}>
                    <Badge colorScheme={PHASE_COLOR[r.phase] || 'gray'} fontSize="xs">{r.phase}</Badge>
                    {r.priority && <Badge colorScheme={PRIORITY_COLOR[r.priority] || 'gray'} fontSize="xs">{r.priority}</Badge>}
                  </HStack>
                  {isOverdue(r.targetShipDate) && r.phase !== 'Shipped' && (
                    <Badge colorScheme="red" fontSize="xs">OVERDUE</Badge>
                  )}
                </Flex>
                <Heading size="sm" noOfLines={2} mt={1}>{r.name}</Heading>
              </Box>

              <Box px={4} py={3}>
                <SimpleGrid columns={2} spacing={2} mb={3}>
                  {status[r.id]?.dateReceived ? (
                    <Box><Text fontSize="xs" color={labelColor}>Received</Text><Text fontSize="sm" fontWeight="medium">{fmtDate(status[r.id].dateReceived)}{status[r.id].receivedFrom ? ` from ${status[r.id].receivedFrom}` : ''}</Text></Box>
                  ) : null}
                  {status[r.id]?.assemblyProgress ? (
                    <Box><Text fontSize="xs" color={labelColor}>Assembly</Text><Text fontSize="sm" fontWeight="medium">{status[r.id].assemblyProgress}</Text></Box>
                  ) : null}
                  {status[r.id]?.logEntries ? (
                    <Box><Text fontSize="xs" color={labelColor}>Daily log</Text><Text fontSize="sm" fontWeight="medium">{status[r.id].logEntries} entr{Number(status[r.id].logEntries) === 1 ? 'y' : 'ies'}, last {fmtDate(status[r.id].lastLogDate)}</Text></Box>
                  ) : null}
                  <Box><Text fontSize="xs" color={labelColor}>Build Type</Text><Text fontSize="sm" fontWeight="medium">{r.buildType || '—'}</Text></Box>
                  <Box><Text fontSize="xs" color={labelColor}>Product</Text><Text fontSize="sm" fontWeight="medium" noOfLines={1}>{r.productType || '—'}</Text></Box>
                  <Box><Text fontSize="xs" color={labelColor}>Serial #</Text><Text fontSize="sm" fontWeight="medium">{r.serialNumber || '—'}</Text></Box>
                  <Box><Text fontSize="xs" color={labelColor}>Customer</Text><Text fontSize="sm" fontWeight="medium" noOfLines={1}>{r.customer || '—'}</Text></Box>
                  <Box><Text fontSize="xs" color={labelColor}>Assigned To</Text><Text fontSize="sm" fontWeight="medium">{userName(r.assignedTo)}</Text></Box>
                  <Box>
                    <Text fontSize="xs" color={labelColor}>Target Ship</Text>
                    <Text fontSize="sm" fontWeight="medium"
                      color={isOverdue(r.targetShipDate) && r.phase !== 'Shipped' ? 'red.500' : undefined}>
                      {fmtDate(r.targetShipDate)}
                    </Text>
                  </Box>
                </SimpleGrid>
                {r.descriptionOfWork && (
                  <Text fontSize="sm" color={labelColor} noOfLines={2} mb={3}>{r.descriptionOfWork}</Text>
                )}
                <Flex gap={2}>
                  <Button size="xs" colorScheme="purple" onClick={() => onSelectWorkOrder(r.id, r.name)}>
                    Pick Parts
                  </Button>
                  <Button size="xs" colorScheme="blue" onClick={() => setBuildOpen({ id: r.id, name: r.name })}>
                    Build
                  </Button>
                  <Button size="xs" variant="outline" onClick={() => hailer!.ui.activity.open(r.id)}>
                    Open
                  </Button>
                </Flex>
              </Box>
            </Box>
          ))}
        </SimpleGrid>
      )}

      {buildOpen && (
        <BuildDetailModal
          workOrderId={buildOpen.id}
          workOrderName={buildOpen.name}
          isOpen
          onClose={() => setBuildOpen(null)}
          onChanged={() => setStatusTick(t => t + 1)}
        />
      )}
    </Box>
  );
}
