import {
  Box, Badge, Button, Center, Checkbox, Flex, Heading, Icon, Image, Input, InputGroup, InputLeftElement,
  SimpleGrid, Spinner, Stat, StatHelpText, StatLabel, StatNumber,
  Table, Tbody, Td, Text, Th, Thead, Tr, useColorModeValue, Select, HStack,
} from '@chakra-ui/react';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  const [supplierFilter, setSupplierFilter] = useState('all');
  // Reorder Selected: one order per supplier, worked through one after another.
  const [queue, setQueue] = useState<InventoryRow[][]>([]);
  const [queueTotal, setQueueTotal] = useState(0);
  const advanced = useRef(false);

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

    const matchSupplier = supplierFilter === 'all' ? true : (r.supplier || '').trim() === (supplierFilter === 'none' ? '' : supplierFilter);

    return matchSearch && matchFilter && matchSupplier;
  });

  // Suppliers present in the inventory, most used first, so the common ones (TMXA, McMaster-Carr) sit at the top.
  const supplierOptions = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach(r => { const k = (r.supplier || '').trim(); counts.set(k, (counts.get(k) || 0) + 1); });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

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

  const selectedRows = rows.filter(r => selected.has(r.id));

  const allFilteredSelected = filteredRows.length > 0 && filteredRows.every(r => selected.has(r.id));
  const someFilteredSelected = filteredRows.some(r => selected.has(r.id));
  function toggleAllFiltered() {
    setSelected(prev => {
      const next = new Set(prev);
      if (allFilteredSelected) filteredRows.forEach(r => next.delete(r.id));
      else filteredRows.forEach(r => next.add(r.id));
      return next;
    });
  }
  // Tick every low / out-of-stock item in the current view (e.g. all low-stock TMXA items) in one click.
  function selectNeedingReorder() {
    setSelected(prev => {
      const next = new Set(prev);
      filteredRows.forEach(r => {
        const q = Number(r.quantityOnHand) || 0, m = Number(r.minimumStock) || 0;
        if (q === 0 || (m > 0 && q <= m)) next.add(r.id);
      });
      return next;
    });
  }

  // Group the ticked items by supplier and open one purchase order per supplier.
  function startReorderSelected() {
    const groups = new Map<string, InventoryRow[]>();
    selectedRows.forEach(r => { const k = (r.supplier || '').trim(); groups.set(k, [...(groups.get(k) || []), r]); });
    const list = [...groups.entries()].sort((a, b) => b[1].length - a[1].length).map(([, v]) => v);
    advanced.current = false;
    setQueueTotal(list.length);
    setQueue(list);
  }
  const queueRows = queue[0] ?? null;
  const activeRows = queueRows ?? reorderRows;
  const activePrefill = useMemo(() => {
    if (!activeRows || activeRows.length === 0) return null;
    const suppliers = new Set(activeRows.map(r => (r.supplier || '').trim()).filter(Boolean));
    return {
      lines: activeRows.map(r => ({ itemId: r.id, sku: r.sku, quantity: suggestedQty(r), unitCost: r.supplierPrice })),
      supplier: suppliers.size === 1 ? [...suppliers][0] : null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRows]);

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
        <Select size="sm" maxW="200px" value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)}>
          <option value="all">All suppliers</option>
          {supplierOptions.map(([name, n]) => <option key={name || 'none'} value={name || 'none'}>{(name || 'No supplier')} ({n})</option>)}
        </Select>
        <Button size="sm" variant="outline" onClick={selectNeedingReorder}>Select low / out of stock</Button>
        {selected.size > 0 && (
          <>
            <Button size="sm" colorScheme="blue" onClick={startReorderSelected}>
              Reorder Selected ({selected.size})
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
          </>
        )}
      </HStack>

      {/* Table */}
      <Box overflowX="auto" border="1px" borderColor={borderColor} borderRadius="md">
        <Table variant="simple" size="sm">
          <Thead bg={theadBg}>
            <Tr>
              <Th px={2}>
                <Checkbox isChecked={allFilteredSelected} isIndeterminate={!allFilteredSelected && someFilteredSelected} onChange={toggleAllFiltered} />
              </Th>
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
        key={queueRows ? `q${queueTotal - queue.length}` : 'single'}
        isOpen={!!activeRows}
        queueLabel={queueRows && queueTotal > 1 ? `Order ${queueTotal - queue.length + 1} of ${queueTotal}` : null}
        // Cancel stops the whole run; a successful save moves on to the next supplier.
        onClose={() => {
          if (advanced.current) { advanced.current = false; return; }
          setQueue([]); setReorderRows(null);
        }}
        onSuccess={() => {
          if (queueRows) {
            advanced.current = true;
            const rest = queue.slice(1);
            setQueue(rest);
            if (rest.length === 0) setSelected(new Set());
          } else {
            setReorderRows(null); setSelected(new Set());
          }
        }}
        prefillLines={activePrefill?.lines}
        prefillSupplier={activePrefill?.supplier}
      />
    </Box>
  );
}
