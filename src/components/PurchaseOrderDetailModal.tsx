import { createActivities } from '../hailer/employees';
import { useEffect, useState } from 'react';
import {
  Badge, Box, Button, Divider, Flex, HStack, Modal, ModalBody, ModalCloseButton,
  ModalContent, ModalHeader, ModalOverlay, NumberInput, NumberInputField, Spinner,
  FormControl, FormLabel, Input, Table, Tbody, Td, Text, Textarea, Th, Thead, Tr, useColorModeValue, useToast,
} from '@chakra-ui/react';
import { ActivityFieldValue } from '@hailer/app-sdk';
import { useApp } from '../hailer/use-app';
import SearchableSelect from './SearchableSelect';
import {
  PurchaseOrderRow, PurchaseOrderLineRow, parseInsight,
  INSIGHT_PO_LINES, INSIGHT_INVENTORY, PO_PHASE_DRAFT, PO_PHASE_ORDERED, PO_SUPPLIER, PO_ORDER_REFERENCE, PO_ORDER_DATE, PO_EXPECTED_DELIVERY_DATE, PO_NOTES, PO_LINE_WORKFLOW, POL_PHASE_PENDING, POL_PARENT_ORDER, POL_INVENTORY_ITEM, POL_SKU, POL_QTY_ORDERED, POL_UNIT_COST,
  PO_PHASE_RECEIVED, PO_PHASE_PARTIALLY_RECEIVED, PO_APPROVED_BY,
  POL_PHASE_RECEIVED, POL_QTY_RECEIVED,
  STOCK_TXN_WORKFLOW, STOCK_TXN_PHASE, STF_TYPE, STF_ITEM, STF_SKU, STF_QTY, STF_DIRECTION, STF_DATE,
  INV_FIELD_QTY,
} from './purchaseOrderConstants';

// Custom date fields come back from insights in SECONDS, not milliseconds.
function fmtDate(sec: number | null): string {
  if (!sec) return '—';
  return new Date(sec * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
function fmtEUR(n: number | null): string {
  if (!n) return '€0.00';
  return '€' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const PHASE_COLOR: Record<string, string> = {
  Pending: 'orange', Received: 'green', Cancelled: 'gray',
};

interface Props {
  order: PurchaseOrderRow | null;
  onClose: () => void;
  onChanged: () => void;
}

interface InvOption { _id: string; name: string; sku: string | null; supplier: string | null; supplierPrice: number | null; }
interface AddDraft { key: string; itemId: string | null; quantity: string; unitCost: string; }
const newDraft = (): AddDraft => ({ key: Math.random().toString(36).slice(2), itemId: null, quantity: '', unitCost: '' });

const secToInput = (sec: number | null) => (sec ? new Date(sec * 1000).toISOString().slice(0, 10) : '');
const inputToMs = (v: string) => (v ? new Date(v).getTime() : null);

export default function PurchaseOrderDetailModal({ order: orderProp, onClose, onChanged }: Props) {
  const { hailer, user } = useApp();
  const toast = useToast();

  // Local overrides so edits show immediately (the list behind this modal refreshes asynchronously).
  const [patch, setPatch] = useState<Partial<PurchaseOrderRow>>({});
  const order: PurchaseOrderRow | null = orderProp ? { ...orderProp, ...patch } : null;
  const [lines, setLines] = useState<PurchaseOrderLineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptQty, setAcceptQty] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  // "Add items" panel: only for orders that are still open (a Received/Cancelled order is closed).
  const [adding, setAdding] = useState(false);
  const [inv, setInv] = useState<InvOption[] | null>(null);
  const [drafts, setDrafts] = useState<AddDraft[]>([newDraft()]);
  const [onlySupplier, setOnlySupplier] = useState(true);
  const [addBusy, setAddBusy] = useState(false);
  const canAdd = !!order && ['Draft', 'Ordered', 'Partially Received'].includes(order.phase);

  // Edit order details + draft / ordered toggle.
  const [editing, setEditing] = useState(false);
  const [users, setUsers] = useState<Array<{ _id: string; name: string }>>([]);
  const [form, setForm] = useState({ supplier: '', ref: '', orderDate: '', expected: '', notes: '', approvedBy: '' });
  const [saving, setSaving] = useState(false);
  const [lineEdits, setLineEdits] = useState<Record<string, { qty?: string; cost?: string }>>({});
  const anyReceived = lines.some((l) => l.phase === 'Received');

  function startEdit() {
    if (!order) return;
    setForm({
      supplier: order.supplier || '', ref: order.orderReference || '',
      orderDate: secToInput(order.orderDate), expected: secToInput(order.expectedDeliveryDate),
      notes: order.notes || '', approvedBy: order.approvedBy || user.current?._id || '',
    });
    setEditing(true);
    if (users.length === 0) {
      hailer!.user.list().then((rows) => setUsers((rows as Array<{ _id: string; firstname?: string; lastname?: string }>)
        .map((u) => ({ _id: u._id, name: `${u.firstname || ''} ${u.lastname || ''}`.trim() || u._id })))).catch(() => {});
    }
  }

  async function saveDetails() {
    if (!order || !hailer) return;
    if (!form.supplier.trim()) { toast({ title: 'Supplier is required', status: 'warning', duration: 3000 }); return; }
    setSaving(true);
    try {
      const fields: Record<string, ActivityFieldValue> = { [PO_SUPPLIER]: form.supplier.trim() };
      // Empty text clears are rejected by Hailer, so only send values that are set.
      if (form.ref.trim()) fields[PO_ORDER_REFERENCE] = form.ref.trim();
      const od = inputToMs(form.orderDate); if (od) fields[PO_ORDER_DATE] = od;
      const ed = inputToMs(form.expected); if (ed) fields[PO_EXPECTED_DELIVERY_DATE] = ed;
      if (form.notes.trim()) fields[PO_NOTES] = form.notes.trim();
      if (form.approvedBy) fields[PO_APPROVED_BY] = form.approvedBy;
      await hailer.activity.update([{ _id: order.id, name: `${form.supplier.trim()}${form.ref.trim() ? ' - ' + form.ref.trim() : ''}`, fields }], {});
      setPatch((p) => ({
        ...p, supplier: form.supplier.trim(), orderReference: form.ref.trim() || order.orderReference,
        orderDate: od ? od / 1000 : order.orderDate, expectedDeliveryDate: ed ? ed / 1000 : order.expectedDeliveryDate,
        notes: form.notes.trim() || order.notes, approvedBy: form.approvedBy || order.approvedBy,
      }));
      setEditing(false);
      toast({ title: 'Order updated', status: 'success', duration: 2500 });
      onChanged();
    } catch (err) {
      toast({ title: 'Could not save', description: String((err as { msg?: string })?.msg ?? err), status: 'error', duration: 6000, isClosable: true });
    }
    setSaving(false);
  }

  async function changeDraftStatus(toDraft: boolean) {
    if (!order || !hailer) return;
    setSaving(true);
    try {
      await hailer.activity.update([{
        _id: order.id, phaseId: toDraft ? PO_PHASE_DRAFT : PO_PHASE_ORDERED,
        // Ordered requires Approved By; default to whoever places it.
        ...(!toDraft && !order.approvedBy && user.current?._id ? { fields: { [PO_APPROVED_BY]: user.current._id } } : {}),
      }], {});
      setPatch((p) => ({ ...p, phase: toDraft ? 'Draft' : 'Ordered', ...(!toDraft && !order.approvedBy ? { approvedBy: user.current?._id ?? null } : {}) }));
      toast({ title: toDraft ? 'Marked as Draft' : 'Order placed (Ordered)', status: 'success', duration: 2500 });
      onChanged();
    } catch (err) {
      toast({ title: 'Could not change status', description: String((err as { msg?: string })?.msg ?? err), status: 'error', duration: 6000, isClosable: true });
    }
    setSaving(false);
  }

  async function saveLine(l: PurchaseOrderLineRow) {
    const e = lineEdits[l.id]; if (!e || !hailer) return;
    const qty = e.qty !== undefined ? Number(e.qty) : l.quantityOrdered;
    if (!qty || qty <= 0) { toast({ title: 'Quantity must be greater than 0', status: 'warning', duration: 3000 }); return; }
    setBusyId(l.id);
    try {
      const fields: Record<string, ActivityFieldValue> = { [POL_QTY_ORDERED]: qty };
      if (e.cost !== undefined && e.cost !== '') fields[POL_UNIT_COST] = Number(e.cost);
      await hailer.activity.update([{ _id: l.id, fields }], {});
      setLineEdits((p) => { const n = { ...p }; delete n[l.id]; return n; });
      toast({ title: 'Line updated', status: 'success', duration: 2000 });
      load(); onChanged();
    } catch (err) {
      toast({ title: 'Could not update line', description: String((err as { msg?: string })?.msg ?? err), status: 'error', duration: 5000, isClosable: true });
    }
    setBusyId(null);
  }

  async function removeLine(l: PurchaseOrderLineRow) {
    if (!window.confirm(`Remove ${l.sku || l.inventoryName || 'this line'} from the order?`)) return;
    setBusyId(l.id);
    try {
      await hailer!.activity.remove([l.id]);
      toast({ title: 'Line removed', status: 'success', duration: 2000 });
      load(); onChanged();
    } catch (err) {
      toast({ title: 'Could not remove line', description: String((err as { msg?: string })?.msg ?? err), status: 'error', duration: 5000, isClosable: true });
    }
    setBusyId(null);
  }

  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const theadBg = useColorModeValue('gray.50', 'gray.800');

  function load() {
    if (!orderProp) return;
    setLoading(true);
    hailer!.insight.data(INSIGHT_PO_LINES, { update: true })
      .then((data) => {
        const all = parseInsight<PurchaseOrderLineRow>(data);
        const forOrder = all.filter((l) => l.parentOrderId === orderProp.id);
        setLines(forOrder);
        const defaults: Record<string, string> = {};
        forOrder.forEach((l) => {
          if (l.phase === 'Pending') defaults[l.id] = String(l.quantityOrdered || 0);
        });
        setAcceptQty(defaults);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => { load(); setAdding(false); setEditing(false); setPatch({}); setLineEdits({}); setDrafts([newDraft()]); }, [orderProp?.id]);

  function openAdd() {
    setAdding(true);
    if (inv) return;
    hailer!.insight.data(INSIGHT_INVENTORY, { update: true })
      .then((data) => setInv(parseInsight<Record<string, unknown>>(data).map((r) => ({
        _id: r.id as string, name: r.name as string, sku: (r.sku as string) || null,
        supplier: (r.supplier as string) || null, supplierPrice: Number(r.supplierPrice) || null,
      }))))
      .catch((err) => toast({ title: 'Could not load inventory', description: String(err), status: 'error' }));
  }

  const supplierKey = (order?.supplier || '').trim().toLowerCase();
  const invOptions = (inv ?? []).filter((i) => !onlySupplier || !supplierKey || (i.supplier || '').trim().toLowerCase() === supplierKey);
  function setDraft(key: string, patch: Partial<AddDraft>) {
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }
  function pickItem(key: string, itemId: string) {
    const item = inv?.find((i) => i._id === itemId);
    // Default the unit cost to the item's supplier price; still editable.
    setDraft(key, { itemId, ...(item?.supplierPrice ? { unitCost: String(item.supplierPrice) } : {}) });
  }

  async function addItems() {
    if (!order || !hailer) return;
    const valid = drafts.filter((d) => d.itemId && Number(d.quantity) > 0);
    if (valid.length === 0) { toast({ title: 'Pick an item and a quantity', status: 'warning', duration: 3000 }); return; }
    setAddBusy(true);
    try {
      await createActivities(hailer, PO_LINE_WORKFLOW, valid.map((d) => {
        const item = inv?.find((i) => i._id === d.itemId);
        const fields: Record<string, ActivityFieldValue> = {
          [POL_PARENT_ORDER]: order.id,
          [POL_INVENTORY_ITEM]: d.itemId as string,
          [POL_QTY_ORDERED]: Number(d.quantity),
        };
        if (item?.sku) fields[POL_SKU] = item.sku;
        if (d.unitCost) fields[POL_UNIT_COST] = Number(d.unitCost);
        return { name: `${item?.sku || item?.name || 'Line'} — ${d.quantity}`, phaseId: POL_PHASE_PENDING, fields };
      }), {});
      toast({ title: `${valid.length} item${valid.length === 1 ? '' : 's'} added to the order`, status: 'success', duration: 3000 });
      setDrafts([newDraft()]);
      setAdding(false);
      load();
      onChanged();
    } catch (err) {
      toast({ title: 'Could not add items', description: String((err as { msg?: string })?.msg ?? err), status: 'error', duration: 6000, isClosable: true });
    }
    setAddBusy(false);
  }

  async function acceptLine(line: PurchaseOrderLineRow) {
    const qty = Number(acceptQty[line.id]) || 0;
    if (qty <= 0) { toast({ title: 'Enter a quantity greater than 0', status: 'warning', duration: 3000 }); return; }
    setBusyId(line.id);
    try {
      // 1. Bump Inventory's Quantity on Hand.
      if (line.inventoryItemId) {
        const inv = await hailer!.activity.get(line.inventoryItemId);
        const currentQty = Number((inv?.fields as Record<string, unknown>)?.[INV_FIELD_QTY]) || 0;
        await hailer!.activity.update([{
          _id: line.inventoryItemId,
          fields: { [INV_FIELD_QTY]: currentQty + qty },
        }], {});
      }

      // 2. Log the Stock Transaction (audit trail — same as Receive Stock).
      const txnFields: Record<string, ActivityFieldValue> = {
        [STF_TYPE]: 'Received',
        [STF_ITEM]: line.inventoryItemId || undefined,
        [STF_QTY]: qty,
        [STF_DIRECTION]: 'In',
        [STF_DATE]: Date.now(),
      } as Record<string, ActivityFieldValue>;
      if (line.sku) txnFields[STF_SKU] = line.sku;
      await createActivities(hailer!, STOCK_TXN_WORKFLOW, [{
        name: `Received — ${line.sku || line.inventoryName || 'item'} (PO)`,
        phaseId: STOCK_TXN_PHASE,
        fields: txnFields,
      }], {});

      // 3. Mark the line Received.
      await hailer!.activity.update([{
        _id: line.id,
        phaseId: POL_PHASE_RECEIVED,
        fields: { [POL_QTY_RECEIVED]: qty },
      }], {});

      // 4. Roll the header phase forward based on remaining lines. Both Received and
      // Partially Received require Approved By — if the order doesn't already have one
      // (e.g. an older order from before that field existed), default to whoever's
      // clicking Receive rather than letting this update throw and leave the header
      // stuck in Ordered despite every line already being marked received.
      const updatedLines = lines.map((l) => (l.id === line.id ? { ...l, phase: 'Received', quantityReceived: qty } : l));
      const stillPending = updatedLines.some((l) => l.phase === 'Pending');
      const anyReceived = updatedLines.some((l) => l.phase === 'Received');
      if (order) {
        const headerFields: Record<string, ActivityFieldValue> = {};
        if (!order.approvedBy && user.current?._id) headerFields[PO_APPROVED_BY] = user.current._id;
        if (!stillPending && anyReceived) {
          await hailer!.activity.update([{ _id: order.id, phaseId: PO_PHASE_RECEIVED, fields: headerFields }], {});
        } else if (anyReceived) {
          await hailer!.activity.update([{ _id: order.id, phaseId: PO_PHASE_PARTIALLY_RECEIVED, fields: headerFields }], {});
        }
      }

      toast({ title: 'Line accepted', description: `${line.sku || line.inventoryName}: +${qty}`, status: 'success', duration: 3000, isClosable: true });
      setLines(updatedLines);
      onChanged();
    } catch (err) {
      toast({ title: 'Error', description: String(err), status: 'error', duration: 5000, isClosable: true });
    }
    setBusyId(null);
  }

  if (!order) return null;

  return (
    <Modal isOpen={!!order} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          {order.supplier}
          {order.orderReference && <Text as="span" fontSize="sm" color="gray.500" ml={2}>#{order.orderReference}</Text>}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <HStack spacing={6} mb={4} flexWrap="wrap">
            <Box><Text fontSize="xs" color="gray.500">Order Date</Text><Text fontSize="sm" fontWeight="medium">{fmtDate(order.orderDate)}</Text></Box>
            <Box><Text fontSize="xs" color="gray.500">Expected Delivery</Text><Text fontSize="sm" fontWeight="medium">{fmtDate(order.expectedDeliveryDate)}</Text></Box>
            <Box><Text fontSize="xs" color="gray.500">Total Value</Text><Text fontSize="sm" fontWeight="medium">{fmtEUR(order.totalOrderValue)}</Text></Box>
            <Box><Text fontSize="xs" color="gray.500">Ordered / Received</Text><Text fontSize="sm" fontWeight="medium">{order.totalQtyOrdered || 0} / {order.totalQtyReceived || 0}</Text></Box>
          </HStack>
          <HStack mb={3} spacing={2} flexWrap="wrap">
            <Badge colorScheme={order.phase === 'Draft' ? 'gray' : order.phase === 'Received' ? 'green' : order.phase === 'Cancelled' ? 'red' : 'blue'}>{order.phase}</Badge>
            {canAdd && !editing && <Button size="xs" variant="outline" onClick={startEdit}>Edit details</Button>}
            {order.phase === 'Ordered' && !anyReceived && (
              <Button size="xs" variant="outline" isLoading={saving} onClick={() => void changeDraftStatus(true)}>Mark as Draft</Button>
            )}
            {order.phase === 'Draft' && (
              <Button size="xs" colorScheme="green" isLoading={saving} onClick={() => void changeDraftStatus(false)}>Place order (Ordered)</Button>
            )}
            <Button size="xs" variant="ghost" onClick={() => hailer!.ui.activity.open(order.id)}>Open in Hailer</Button>
          </HStack>
          {editing && (
            <Box border="1px" borderColor={borderColor} borderRadius="md" p={3} mb={4}>
              <HStack spacing={3} mb={3} align="start">
                <FormControl isRequired><FormLabel fontSize="xs">Supplier</FormLabel><Input size="sm" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} /></FormControl>
                <FormControl><FormLabel fontSize="xs">Order Reference</FormLabel><Input size="sm" value={form.ref} onChange={(e) => setForm({ ...form, ref: e.target.value })} /></FormControl>
              </HStack>
              <HStack spacing={3} mb={3}>
                <FormControl><FormLabel fontSize="xs">Order Date</FormLabel><Input size="sm" type="date" value={form.orderDate} onChange={(e) => setForm({ ...form, orderDate: e.target.value })} /></FormControl>
                <FormControl><FormLabel fontSize="xs">Expected Delivery</FormLabel><Input size="sm" type="date" value={form.expected} onChange={(e) => setForm({ ...form, expected: e.target.value })} /></FormControl>
              </HStack>
              <FormControl mb={3}>
                <FormLabel fontSize="xs">Approved By</FormLabel>
                <SearchableSelect value={form.approvedBy || null} onChange={(v) => setForm({ ...form, approvedBy: v })}
                  options={users} placeholder="Search person..." />
              </FormControl>
              <FormControl mb={3}><FormLabel fontSize="xs">Notes</FormLabel><Textarea size="sm" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></FormControl>
              <HStack>
                <Button size="xs" colorScheme="blue" isLoading={saving} onClick={() => void saveDetails()}>Save</Button>
                <Button size="xs" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              </HStack>
            </Box>
          )}
          <Divider mb={4} />

          {canAdd ? (
            adding ? (
              <Box border="1px" borderColor={borderColor} borderRadius="md" p={3} mb={4}>
                <Flex justify="space-between" align="center" mb={2}>
                  <Text fontWeight="semibold" fontSize="sm">Add items to this order</Text>
                  {order.supplier && (
                    <Button size="xs" variant="link" onClick={() => setOnlySupplier((v) => !v)}>
                      {onlySupplier ? `Showing ${order.supplier} items only. Show all` : 'Showing all items. Show only ' + order.supplier}
                    </Button>
                  )}
                </Flex>
                {!inv ? <Spinner size="sm" /> : (
                  <>
                    {drafts.map((d) => (
                      <HStack key={d.key} spacing={2} mb={2} align="start">
                        <Box flex={3}>
                          <SearchableSelect value={d.itemId} onChange={(v) => pickItem(d.key, v)}
                            options={invOptions.map((i) => ({ _id: i._id, name: i.name, badge: i.sku || undefined }))}
                            placeholder="Search item..." />
                        </Box>
                        <NumberInput size="md" min={1} maxW="90px" value={d.quantity} onChange={(v) => setDraft(d.key, { quantity: v })}>
                          <NumberInputField placeholder="Qty" />
                        </NumberInput>
                        <NumberInput size="md" min={0} maxW="110px" value={d.unitCost} onChange={(v) => setDraft(d.key, { unitCost: v })}>
                          <NumberInputField placeholder="Unit €" />
                        </NumberInput>
                      </HStack>
                    ))}
                    <HStack>
                      <Button size="xs" variant="outline" onClick={() => setDrafts((p) => [...p, newDraft()])}>+ Another item</Button>
                      <Button size="xs" colorScheme="blue" isLoading={addBusy} onClick={() => void addItems()}>Add to order</Button>
                      <Button size="xs" variant="ghost" onClick={() => { setAdding(false); setDrafts([newDraft()]); }}>Cancel</Button>
                    </HStack>
                  </>
                )}
              </Box>
            ) : (
              <Button size="sm" colorScheme="blue" variant="outline" mb={4} onClick={openAdd}>+ Add items to this order</Button>
            )
          ) : (
            <Text fontSize="xs" color="gray.500" mb={4}>This order is {order.phase.toLowerCase()}, so items can't be added. Create a new order instead.</Text>
          )}

          {loading ? (
            <Flex justify="center" py={8}><Spinner /></Flex>
          ) : (
            <Box overflowX="auto" border="1px" borderColor={borderColor} borderRadius="md">
              <Table variant="simple" size="sm">
                <Thead bg={theadBg}>
                  <Tr>
                    <Th>Item</Th>
                    <Th isNumeric>Ordered</Th>
                    <Th isNumeric>Unit Cost</Th>
                    <Th isNumeric>Line Total</Th>
                    <Th>Status</Th>
                    <Th>Accept</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {lines.map((l) => (
                    <Tr key={l.id}>
                      <Td>
                        <Text fontWeight="medium" fontSize="sm">{l.sku || l.inventoryName}</Text>
                        {l.inventoryName && l.sku && <Text fontSize="xs" color="gray.500" noOfLines={1}>{l.inventoryName}</Text>}
                      </Td>
                      <Td isNumeric>
                        {canAdd && l.phase === 'Pending' ? (
                          <NumberInput size="xs" maxW="70px" min={1} value={lineEdits[l.id]?.qty ?? String(l.quantityOrdered ?? '')}
                            onChange={(v) => setLineEdits((p) => ({ ...p, [l.id]: { ...p[l.id], qty: v } }))}>
                            <NumberInputField />
                          </NumberInput>
                        ) : (l.quantityOrdered ?? '—')}
                      </Td>
                      <Td isNumeric>
                        {canAdd && l.phase === 'Pending' ? (
                          <NumberInput size="xs" maxW="80px" min={0} value={lineEdits[l.id]?.cost ?? String(l.unitCost ?? '')}
                            onChange={(v) => setLineEdits((p) => ({ ...p, [l.id]: { ...p[l.id], cost: v } }))}>
                            <NumberInputField />
                          </NumberInput>
                        ) : (l.unitCost ? fmtEUR(l.unitCost) : '—')}
                      </Td>
                      <Td isNumeric>{l.lineTotal ? fmtEUR(l.lineTotal) : '—'}</Td>
                      <Td>
                        <Badge colorScheme={PHASE_COLOR[l.phase] || 'gray'} fontSize="xs">
                          {l.phase === 'Received' ? `Received (${l.quantityReceived ?? l.quantityOrdered})` : l.phase}
                        </Badge>
                      </Td>
                      <Td>
                        {l.phase === 'Pending' && lineEdits[l.id] && (
                          <Button size="xs" colorScheme="blue" mr={1} isLoading={busyId === l.id} onClick={() => void saveLine(l)}>Save</Button>
                        )}
                        {canAdd && l.phase === 'Pending' && (
                          <Button size="xs" variant="ghost" colorScheme="red" mr={1} isDisabled={busyId === l.id} onClick={() => void removeLine(l)}>Remove</Button>
                        )}
                        {l.phase === 'Pending' && order.phase !== 'Draft' && (
                          <HStack spacing={1}>
                            <NumberInput size="xs" maxW="70px" min={0} value={acceptQty[l.id] ?? ''}
                              onChange={(v) => setAcceptQty((prev) => ({ ...prev, [l.id]: v }))}>
                              <NumberInputField />
                            </NumberInput>
                            <Button size="xs" colorScheme="green" isLoading={busyId === l.id} onClick={() => acceptLine(l)}>
                              Accept
                            </Button>
                          </HStack>
                        )}
                      </Td>
                    </Tr>
                  ))}
                  {lines.length === 0 && (
                    <Tr><Td colSpan={6}><Text color="gray.500" textAlign="center" py={6}>No line items.</Text></Td></Tr>
                  )}
                </Tbody>
              </Table>
            </Box>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
