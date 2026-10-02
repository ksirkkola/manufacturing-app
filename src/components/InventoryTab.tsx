import {
  Box, Badge, Button, Center, Checkbox, Flex, Heading, Icon, Image, Input, InputGroup, InputLeftElement,
  SimpleGrid, Spinner, Stat, StatHelpText, StatLabel, StatNumber,
  Table, Tbody, Td, Text, Th, Thead, Tr, useColorModeValue, Select, HStack,
} from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import { fetchInsight } from '../hailer/insight-queue';
import { useApp } from '../hailer/use-app';
import { HailerDocImage } from '../hailer/theme/icons/HailerDocImage';
import NewPurchaseOrderModal from './NewPurchaseOrderModal';

const INSIGHT_INVENTORY = '6a4dddce6f85b474eebdc1f7';

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

interface InventoryRow {
  id: string;
  name: string;
  sku: string | null;
  photo: string | null;
  quantityOnHand: number | null;
  minimumStock: number | null;
  supplier: string | null;
  salesPrice: number | null;
  supplierPrice: number | null;
  binLocation: string | null;
  systemTags: string | null;
}

function fmt(val: unknown): string {
  const n = Number(val);
  if (!val || isNaN(n) || n === 0) return '—';
  return '€' + n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function parseInsight(data: { headers: string[]; rows: unknown[][] }): InventoryRow[] {
  return data.rows.map(row => {
    const r: Record<string, unknown> = {};
    data.headers.forEach((h, i) => { r[h] = row[i]; });
    return r as unknown as InventoryRow;
  });
}

interface RefreshProps { refreshKey?: number }
export default function InventoryTab({ refreshKey = 0 }: RefreshProps) {
  const { hailer, inside } = useApp();
  const [rows, setRows]         = useState<InventoryRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [search, setSearch]     = useState('');
  const [filter, setFilter]     = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reorderRows, setReorderRows] = useState<InventoryRow[] | null>(null);

  const cardBg      = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const theadBg     = useColorModeValue('gray.50', 'gray.800');
  const rowHover    = useColorModeValue('gray.50', 'gray.600');

  useEffect(() => {
    if (!inside) return;
    setLoading(true);
    fetchInsight(hailer!, INSIGHT_INVENTORY)
      .then(data => { setRows(parseInsight(data)); setLoading(false); })
      .catch(err => { setError(String(err)); setLoading(false); });
  }, [inside, refreshKey]);

  const lowStock  = rows.filter(r => (r.minimumStock || 0) > 0 && (r.quantityOnHand || 0) <= (r.minimumStock || 0));
  const outOfStock = rows.filter(r => (r.quantityOnHand || 0) === 0);

  const filteredRows = rows.filter(r => {
    const matchSearch = !search ||
      (r.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.sku || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.systemTags || '').toLowerCase().includes(search.toLowerCase());

    const matchFilter =
      filter === 'all' ? true :
      filter === 'low' ? (r.minimumStock || 0) > 0 && (r.quantityOnHand || 0) <= (r.minimumStock || 0) :
      filter === 'out' ? (r.quantityOnHand || 0) === 0 : true;

    return matchSearch && matchFilter;
  });

  function suggestedQty(r: InventoryRow): number {
    const qty = Number(r.quantityOnHand) || 0;
    const min = Number(r.minimumStock) || 0;
    return Math.max(min - qty, 1);
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // If every selected row shares the same Supplier text, pre-fill it on the PO —
  // otherwise leave it blank since the modal's Supplier field is one value for the whole order.
  const reorderPrefill = useMemo(() => {
    if (!reorderRows || reorderRows.length === 0) return null;
    const suppliers = new Set(reorderRows.map(r => (r.supplier || '').trim()).filter(Boolean));
    return {
      lines: reorderRows.map(r => ({ itemId: r.id, sku: r.sku, quantity: suggestedQty(r) })),
      supplier: suppliers.size === 1 ? [...suppliers][0] : null,
    };
  }, [reorderRows]);

  const selectedRows = rows.filter(r => selected.has(r.id));

  if (loading) return <Flex justify="center" align="center" h="300px"><Spinner size="xl" /></Flex>;
  if (error)   return <Text color="red.500">Error: {error}</Text>;

  return (
    <Box>
      {/* Summary cards */}
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={6}>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor}>
          <Stat>
            <StatLabel>Total Items</StatLabel>
            <StatNumber>{rows.length}</StatNumber>
            <StatHelpText>In inventory</StatHelpText>
          </Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor}
          borderTop="3px solid" borderTopColor="red.400">
          <Stat>
            <StatLabel>Out of Stock</StatLabel>
            <StatNumber color="red.500">{outOfStock.length}</StatNumber>
            <StatHelpText>Qty = 0</StatHelpText>
          </Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor}
          borderTop="3px solid" borderTopColor="orange.400">
          <Stat>
            <StatLabel>Low Stock</StatLabel>
            <StatNumber color="orange.500">{lowStock.length}</StatNumber>
            <StatHelpText>At or below minimum</StatHelpText>
          </Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor}
          borderTop="3px solid" borderTopColor="green.400">
          <Stat>
            <StatLabel>Well Stocked</StatLabel>
            <StatNumber color="green.500">{rows.length - lowStock.length - outOfStock.length}</StatNumber>
            <StatHelpText>Above minimum</StatHelpText>
          </Stat>
        </Box>
      </SimpleGrid>

      {/* Search + filter */}
      <HStack mb={4} spacing={3} flexWrap="wrap">
        <InputGroup maxW="300px" size="sm">
          <InputLeftElement pointerEvents="none">
            <Text color="gray.400" fontSize="xs">🔍</Text>
          </InputLeftElement>
          <Input placeholder="Search by name, SKU, tags..." value={search} onChange={e => setSearch(e.target.value)} />
        </InputGroup>
        <Select size="sm" maxW="200px" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">All Items</option>
          <option value="low">Low Stock</option>
          <option value="out">Out of Stock</option>
        </Select>
        <Text fontSize="sm" color="gray.500">{filteredRows.length} items</Text>
        {selected.size > 0 && (
          <Button size="sm" colorScheme="blue" onClick={() => setReorderRows(selectedRows)}>
            Reorder Selected ({selected.size})
          </Button>
        )}
      </HStack>

      {/* Table */}
      <Box overflowX="auto" border="1px" borderColor={borderColor} borderRadius="md">
        <Table variant="simple" size="sm">
          <Thead bg={theadBg}>
            <Tr>
              <Th px={2}></Th>
              <Th>Photo</Th>
              <Th>SKU</Th>
              <Th>Name</Th>
              <Th>Bin</Th>
              <Th isNumeric>On Hand</Th>
              <Th isNumeric>Min Stock</Th>
              <Th>Status</Th>
              <Th>Supplier</Th>
              <Th isNumeric>Supplier Price</Th>
              <Th>Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {filteredRows.map(r => {
              const qty  = Number(r.quantityOnHand) || 0;
              const min  = Number(r.minimumStock) || 0;
              const isOut = qty === 0;
              const isLow = min > 0 && qty <= min && !isOut;

              return (
                <Tr key={r.id} _hover={{ bg: rowHover }} cursor="pointer"
                  onClick={() => hailer!.ui.activity.open(r.id)}
                  bg={isOut ? useColorModeValue('red.50', 'red.900') :
                      isLow ? useColorModeValue('orange.50', 'orange.900') : undefined}>
                  <Td px={2} onClick={(e) => e.stopPropagation()} cursor="default">
                    <Checkbox isChecked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} />
                  </Td>
                  <Td onClick={(e) => e.stopPropagation()} cursor="default">
                    {(() => {
                      const fileId = firstFileId(r.photo);
                      return fileId ? (
                        <Image src={imageUrl(fileId)} alt={r.name} boxSize="36px" objectFit="contain" borderRadius="md" />
                      ) : (
                        <Center boxSize="36px" bg={theadBg} borderRadius="md">
                          <Icon as={HailerDocImage} boxSize={4} color="gray.300" />
                        </Center>
                      );
                    })()}
                  </Td>
                  <Td whiteSpace="nowrap" fontWeight="medium">{r.sku || '—'}</Td>
                  <Td maxW="200px">
                    <Text fontWeight="medium" noOfLines={1}>{r.name}</Text>
                    {r.systemTags && <Text fontSize="xs" color="gray.500">{r.systemTags}</Text>}
                  </Td>
                  <Td whiteSpace="nowrap">{r.binLocation || '—'}</Td>
                  <Td isNumeric fontWeight="bold"
                    color={isOut ? 'red.500' : isLow ? 'orange.500' : 'green.600'}>
                    {qty}
                  </Td>
                  <Td isNumeric>{min || '—'}</Td>
                  <Td>
                    {isOut ? <Badge colorScheme="red">Out of Stock</Badge> :
                     isLow ? <Badge colorScheme="orange">Low Stock</Badge> :
                     <Badge colorScheme="green">OK</Badge>}
                  </Td>
                  <Td maxW="150px" isTruncated>{r.supplier || '—'}</Td>
                  <Td isNumeric>{fmt(r.supplierPrice)}</Td>
                  <Td onClick={(e) => e.stopPropagation()} cursor="default">
                    {(isLow || isOut) && (
                      <Button size="xs" colorScheme="blue" variant="outline" onClick={() => setReorderRows([r])}>
                        Reorder
                      </Button>
                    )}
                  </Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      </Box>

      <NewPurchaseOrderModal
        isOpen={!!reorderRows}
        onClose={() => setReorderRows(null)}
        onSuccess={() => { setReorderRows(null); setSelected(new Set()); }}
        prefillLines={reorderPrefill?.lines}
        prefillSupplier={reorderPrefill?.supplier}
      />
    </Box>
  );
}
