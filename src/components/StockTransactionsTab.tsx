import {
  Box, Badge, Button, Flex, HStack, Input, InputGroup, InputLeftElement,
  Select, SimpleGrid, Spinner, Stat, StatLabel, StatNumber,
  Table, Tbody, Td, Text, Th, Thead, Tr, useColorModeValue,
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { fetchInsight } from '../hailer/insight-queue';
import { useApp } from '../hailer/use-app';
import ReceiveStockModal from './ReceiveStockModal';
import LogStockTransactionModal from './LogStockTransactionModal';

const INSIGHT_TRANSACTIONS = '6a4f6fd97e6d5987425c027d';

interface TxnRow {
  id: string;
  name: string;
  phase: string;
  transactionType: string | null;
  inventoryItem: string | null;
  sku: string | null;
  quantity: number | null;
  direction: string | null;
  transactionDate: number | null;
  workOrder: string | null;
  trip: string | null;
  bigcommerceOrder: string | null;
  notes: string | null;
}

function fmtDate(val: unknown): string {
  if (!val || isNaN(Number(val))) return '—';
  const n = Number(val);
  // Handle both seconds and milliseconds
  const ms = n > 1e10 ? n : n * 1000;
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function parseInsight(data: { headers: string[]; rows: unknown[][] }): TxnRow[] {
  return data.rows.map(row => {
    const r: Record<string, unknown> = {};
    data.headers.forEach((h, i) => { r[h] = row[i]; });
    return r as unknown as TxnRow;
  });
}

const TYPE_COLOR: Record<string, string> = {
  'Received':      'green',
  'Used in Build': 'purple',
  'Used on Trip':  'blue',
  'Sold (Online)': 'teal',
  'Returned':      'cyan',
  'Adjusted':      'yellow',
  'Written Off':   'red',
};

const ALL_TYPES = ['Received', 'Used in Build', 'Used on Trip', 'Sold (Online)', 'Returned', 'Adjusted', 'Written Off'];

interface RefreshProps { refreshKey?: number; onDataChanged?: () => void }
export default function StockTransactionsTab({ refreshKey = 0, onDataChanged }: RefreshProps) {
  const { hailer, inside } = useApp();
  const [rows, setRows]       = useState<TxnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [search, setSearch]   = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [dirFilter, setDirFilter]   = useState('All');
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

  const cardBg      = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const theadBg     = useColorModeValue('gray.50', 'gray.800');
  const rowHover    = useColorModeValue('gray.50', 'gray.600');
  const mutedText   = useColorModeValue('gray.500', 'gray.400');

  useEffect(() => {
    if (!inside) return;
    setLoading(true);
    fetchInsight(hailer!, INSIGHT_TRANSACTIONS)
      .then(data => { setRows(parseInsight(data)); setLoading(false); })
      .catch(err => { setError(String(err)); setLoading(false); });
  }, [inside, refreshKey]);

  const filtered = rows.filter(r => {
    const matchSearch = !search ||
      (r.sku || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.bigcommerceOrder || '').toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'All' || r.transactionType === typeFilter;
    const matchDir  = dirFilter === 'All' || r.direction === dirFilter;
    return matchSearch && matchType && matchDir;
  });

  // Summary counts
  const typeCounts = ALL_TYPES.reduce<Record<string, number>>((acc, t) => {
    acc[t] = rows.filter(r => r.transactionType === t).length;
    return acc;
  }, {});

  const totalIn  = rows.filter(r => r.direction === 'In').reduce((s, r) => s + (Number(r.quantity) || 0), 0);
  const totalOut = rows.filter(r => r.direction === 'Out').reduce((s, r) => s + (Number(r.quantity) || 0), 0);

  if (loading) return <Flex justify="center" align="center" h="300px"><Spinner size="xl" /></Flex>;
  if (error)   return <Text color="red.500">Error: {error}</Text>;

  return (
    <Box>
      <Flex justify="flex-end" mb={4} gap={2}>
        <Button colorScheme="blue" variant="outline" size="sm" onClick={() => setLogOpen(true)}>
          + Log Transaction
        </Button>
        <Button colorScheme="green" size="sm" onClick={() => setReceiveOpen(true)}>
          + Receive Stock
        </Button>
      </Flex>

      <ReceiveStockModal
        isOpen={receiveOpen}
        onClose={() => setReceiveOpen(false)}
        onSuccess={() => onDataChanged?.()}
      />

      <LogStockTransactionModal
        isOpen={logOpen}
        onClose={() => setLogOpen(false)}
        onSuccess={() => onDataChanged?.()}
      />

      {/* Summary */}
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={6}>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor}>
          <Stat><StatLabel>Total Transactions</StatLabel><StatNumber>{rows.length}</StatNumber></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor}
          borderTop="3px solid" borderTopColor="green.400">
          <Stat><StatLabel>Total In</StatLabel><StatNumber color="green.500">{totalIn}</StatNumber></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor}
          borderTop="3px solid" borderTopColor="red.400">
          <Stat><StatLabel>Total Out</StatLabel><StatNumber color="red.500">{totalOut}</StatNumber></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor}>
          <Stat><StatLabel>Net Movement</StatLabel>
            <StatNumber color={totalIn - totalOut >= 0 ? 'green.500' : 'red.500'}>
              {totalIn - totalOut >= 0 ? '+' : ''}{totalIn - totalOut}
            </StatNumber>
          </Stat>
        </Box>
      </SimpleGrid>

      {/* Type breakdown */}
      <SimpleGrid columns={{ base: 2, md: 4, lg: 7 }} spacing={2} mb={6}>
        {ALL_TYPES.map(t => (
          <Box key={t} p={2} bg={cardBg} borderRadius="md" border="1px" borderColor={borderColor}
            borderTop="3px solid" borderTopColor={`${TYPE_COLOR[t] || 'gray'}.400`}
            cursor="pointer" onClick={() => setTypeFilter(typeFilter === t ? 'All' : t)}
            opacity={typeFilter !== 'All' && typeFilter !== t ? 0.5 : 1}>
            <Text fontSize="xs" color={mutedText} noOfLines={1}>{t}</Text>
            <Text fontWeight="bold">{typeCounts[t]}</Text>
          </Box>
        ))}
      </SimpleGrid>

      {/* Filters */}
      <HStack mb={4} spacing={3} flexWrap="wrap">
        <InputGroup maxW="280px" size="sm">
          <InputLeftElement><Text color="gray.400" fontSize="xs">🔍</Text></InputLeftElement>
          <Input placeholder="Search SKU, name, order #..." value={search} onChange={e => setSearch(e.target.value)} />
        </InputGroup>
        <Select size="sm" maxW="180px" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="All">All Types</option>
          {ALL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </Select>
        <Select size="sm" maxW="140px" value={dirFilter} onChange={e => setDirFilter(e.target.value)}>
          <option value="All">All Directions</option>
          <option value="In">In</option>
          <option value="Out">Out</option>
        </Select>
        <Text fontSize="sm" color={mutedText}>{filtered.length} records</Text>
      </HStack>

      {/* Table */}
      <Box overflowX="auto" border="1px" borderColor={borderColor} borderRadius="md">
        <Table variant="simple" size="sm">
          <Thead bg={theadBg}>
            <Tr>
              <Th>Date</Th>
              <Th>Type</Th>
              <Th>SKU</Th>
              <Th>Item</Th>
              <Th>Dir</Th>
              <Th isNumeric>Qty</Th>
              <Th>Reference</Th>
              <Th>Status</Th>
            </Tr>
          </Thead>
          <Tbody>
            {filtered.map(r => (
              <Tr key={r.id} _hover={{ bg: rowHover }} cursor="pointer"
                onClick={() => hailer!.ui.activity.open(r.id)}>
                <Td whiteSpace="nowrap">{fmtDate(r.transactionDate)}</Td>
                <Td>
                  <Badge colorScheme={TYPE_COLOR[r.transactionType || ''] || 'gray'} fontSize="xs">
                    {r.transactionType || '—'}
                  </Badge>
                </Td>
                <Td fontWeight="medium" whiteSpace="nowrap">{r.sku || '—'}</Td>
                <Td maxW="180px" isTruncated>{r.name}</Td>
                <Td>
                  <Badge colorScheme={r.direction === 'In' ? 'green' : 'red'} fontSize="xs">
                    {r.direction || '—'}
                  </Badge>
                </Td>
                <Td isNumeric fontWeight="bold">{r.quantity || '—'}</Td>
                <Td maxW="160px">
                  {r.bigcommerceOrder && <Text fontSize="xs">BC #{r.bigcommerceOrder}</Text>}
                  {r.workOrder && <Text fontSize="xs" color={mutedText}>WO</Text>}
                  {r.trip && <Text fontSize="xs" color={mutedText}>Trip</Text>}
                </Td>
                <Td>
                  <Badge colorScheme={r.phase === 'Voided' ? 'red' : 'green'} fontSize="xs">
                    {r.phase}
                  </Badge>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
        {filtered.length === 0 && (
          <Text textAlign="center" py={8} color={mutedText}>No transactions found.</Text>
        )}
      </Box>
    </Box>
  );
}
