import { createActivities } from '../hailer/employees';
import { useEffect, useState } from 'react';
import {
  Alert, AlertIcon, Box, Button, Divider, FormControl, FormLabel, HStack, IconButton, Input,
  Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay,
  NumberInput, NumberInputField, Spinner, Text, Textarea, VStack, useToast,
} from '@chakra-ui/react';
import { ActivityFieldValue } from '@hailer/app-sdk';
import { useApp } from '../hailer/use-app';
import SearchableSelect from './SearchableSelect';
import { HailerXSmall } from '../hailer/theme/icons/HailerXSmall';
import {
  PO_WORKFLOW, PO_PHASE_ORDERED, PO_PHASE_DRAFT, PO_SUPPLIER, PO_ORDER_REFERENCE, PO_ORDER_DATE,
  PO_EXPECTED_DELIVERY_DATE, PO_NOTES, PO_APPROVED_BY,
  PO_LINE_WORKFLOW, POL_PHASE_PENDING, POL_PARENT_ORDER, POL_INVENTORY_ITEM, POL_SKU,
  POL_QTY_ORDERED, POL_UNIT_COST,
  INSIGHT_INVENTORY,
} from './purchaseOrderConstants';

interface InventoryOption { _id: string; name: string; sku: string | null; }
interface UserOption { _id: string; name: string; }

interface LineDraft {
  key: string;
  itemId: string | null;
  quantity: string;
  unitCost: string;
}

function newLine(): LineDraft {
  return { key: Math.random().toString(36).slice(2), itemId: null, quantity: '', unitCost: '' };
}

function toDateInputValue(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
function dateInputToMs(v: string): number | undefined {
  return v ? new Date(v).getTime() : undefined;
}

function parseInsight(data: { headers: string[]; rows: unknown[][] }): Record<string, unknown>[] {
  return data.rows.map((row) => {
    const r: Record<string, unknown> = {};
    data.headers.forEach((h, i) => { r[h] = row[i]; });
    return r;
  });
}

// Pre-fill one or more lines when opening from a shortcut (e.g. "Reorder" on the
// Inventory tab) instead of the blank "+ New Purchase Order" form. Multiple low-stock
// items from the same manufacturer can be batched onto one PO this way — select several
// rows, hit "Reorder Selected", and they all show up here as separate lines already.
interface PrefillLine { itemId: string; sku?: string | null; quantity?: number; unitCost?: number | null; }

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  prefillLines?: PrefillLine[] | null;
  prefillSupplier?: string | null;
  /** e.g. "Order 1 of 2" when several supplier orders are being created in a row. */
  queueLabel?: string | null;
}

export default function NewPurchaseOrderModal({ isOpen, onClose, onSuccess, prefillLines, prefillSupplier, queueLabel }: Props) {
  const { hailer, user } = useApp();
  const toast = useToast();

  const [items, setItems] = useState<InventoryOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [supplier, setSupplier] = useState('');
  const [orderReference, setOrderReference] = useState('');
  const [orderDate, setOrderDate] = useState(toDateInputValue(Date.now()));
  const [expectedDelivery, setExpectedDelivery] = useState('');
  const [notes, setNotes] = useState('');
  const [approvedBy, setApprovedBy] = useState<string | null>(null);
  const [lines, setLines] = useState<LineDraft[]>([newLine()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoadingItems(true);
    Promise.all([
      hailer!.insight.data(INSIGHT_INVENTORY, { update: true }),
      hailer!.user.list(),
    ])
      .then(([data, userRows]) => {
        const rows = parseInsight(data);
        setItems(rows.map((r) => ({ _id: r.id as string, name: r.name as string, sku: (r.sku as string) || null })));
        setUsers((userRows as Array<{ _id: string; firstname?: string; lastname?: string }>).map((u) => ({
          _id: u._id, name: `${u.firstname || ''} ${u.lastname || ''}`.trim() || u._id,
        })));
        setLoadingItems(false);
      })
      .catch((err) => { setError(String(err)); setLoadingItems(false); });
  }, [isOpen, hailer]);

  // The "Ordered" phase requires Approved By — money commits at that point, and this
  // modal always creates straight into Ordered. Default to whoever's filling out the
  // form (they're the one clicking "Create Order"), but leave it editable in case
  // they're placing it on someone else's behalf.
  useEffect(() => {
    if (!isOpen) return;
    setApprovedBy((prev) => prev ?? user.current?._id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user.current]);

  // Seed from a Reorder shortcut. reset() already ran on the previous close (see handleClose),
  // so this always starts from a blank slate before applying the prefill — no stale carryover
  // between "+ New Purchase Order" (no prefill) and "Reorder" (prefill) on the same modal instance.
  useEffect(() => {
    if (!isOpen) return;
    if (prefillLines && prefillLines.length > 0) {
      setSupplier(prefillSupplier || '');
      setLines(prefillLines.map((p) => ({
        key: Math.random().toString(36).slice(2),
        itemId: p.itemId,
        quantity: p.quantity ? String(p.quantity) : '',
        unitCost: p.unitCost ? String(p.unitCost) : '',
      })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function reset() {
    setSupplier('');
    setOrderReference('');
    setOrderDate(toDateInputValue(Date.now()));
    setExpectedDelivery('');
    setNotes('');
    setApprovedBy(null);
    setLines([newLine()]);
    setError(null);
  }
  function handleClose() { reset(); onClose(); }

  function updateLine(key: string, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function addLine() { setLines((prev) => [...prev, newLine()]); }
  function removeLine(key: string) { setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev)); }

  const validLines = lines.filter((l) => l.itemId && Number(l.quantity) > 0);

  async function handleSubmit(asDraft = false) {
    if (!supplier.trim()) { setError('Supplier is required.'); return; }
    if (validLines.length === 0) { setError('Add at least one line item with a quantity.'); return; }
    if (!asDraft && !approvedBy) { setError('Approved By is required — this order is created directly into Ordered, where money commits.'); return; }

    setSubmitting(true);
    setError(null);
    try {
      const headerFields: Record<string, ActivityFieldValue> = {
        [PO_SUPPLIER]: supplier.trim(),
      };
      // Approved By is only required once the order is placed (Ordered); a draft can leave it empty.
      if (approvedBy) headerFields[PO_APPROVED_BY] = approvedBy;
      if (orderReference.trim()) headerFields[PO_ORDER_REFERENCE] = orderReference.trim();
      const orderMs = dateInputToMs(orderDate);
      if (orderMs) headerFields[PO_ORDER_DATE] = orderMs;
      const deliveryMs = dateInputToMs(expectedDelivery);
      if (deliveryMs) headerFields[PO_EXPECTED_DELIVERY_DATE] = deliveryMs;
      if (notes.trim()) headerFields[PO_NOTES] = notes.trim();

      const created = await createActivities(hailer!, PO_WORKFLOW, [{
        name: `${supplier.trim()}${orderReference.trim() ? ' - ' + orderReference.trim() : ''}`,
        phaseId: asDraft ? PO_PHASE_DRAFT : PO_PHASE_ORDERED,
        fields: headerFields,
      }], {});

      const orderId = created?.[0]?._id;
      if (!orderId) throw new Error('Order was not created — check Hailer before retrying.');

      await createActivities(hailer!, PO_LINE_WORKFLOW, validLines.map((l) => {
        const item = items.find((i) => i._id === l.itemId);
        const fields: Record<string, ActivityFieldValue> = {
          [POL_PARENT_ORDER]: orderId,
          [POL_INVENTORY_ITEM]: l.itemId as string,
          [POL_QTY_ORDERED]: Number(l.quantity),
        };
        if (item?.sku) fields[POL_SKU] = item.sku;
        if (l.unitCost) fields[POL_UNIT_COST] = Number(l.unitCost);
        return {
          name: `${item?.sku || item?.name || 'Line'} — ${l.quantity}`,
          phaseId: POL_PHASE_PENDING,
          fields,
        };
      }), {});

      toast({ title: asDraft ? 'Draft purchase order saved' : 'Purchase order created', description: supplier, status: 'success', duration: 3000, isClosable: true });
      onSuccess();
      handleClose();
    } catch (err) {
      setError(String(err));
    }
    setSubmitting(false);
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>New Purchase Order{queueLabel ? <Text as="span" fontSize="sm" fontWeight="normal" color="gray.500" ml={2}>{queueLabel}</Text> : null}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack align="stretch" spacing={4}>
            {error && (
              <Alert status="error" borderRadius="md" fontSize="sm">
                <AlertIcon />
                {error}
              </Alert>
            )}

            <HStack spacing={3} align="start">
              <FormControl isRequired>
                <FormLabel fontSize="sm">Supplier</FormLabel>
                <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="e.g. Acme Parts Co" />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Order Reference</FormLabel>
                <Input value={orderReference} onChange={(e) => setOrderReference(e.target.value)} placeholder="PO # (optional)" />
              </FormControl>
            </HStack>

            <HStack spacing={3}>
              <FormControl>
                <FormLabel fontSize="sm">Order Date</FormLabel>
                <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Expected Delivery</FormLabel>
                <Input type="date" value={expectedDelivery} onChange={(e) => setExpectedDelivery(e.target.value)} />
              </FormControl>
            </HStack>

            <FormControl>
              <FormLabel fontSize="sm">Approved By <Text as="span" fontSize="xs" color="gray.500">(needed to place the order, not for a draft)</Text></FormLabel>
              <SearchableSelect
                value={approvedBy}
                onChange={(v) => setApprovedBy(v || null)}
                options={users.map((u) => ({ _id: u._id, name: u.name }))}
                placeholder="Search person..."
              />
            </FormControl>

            <Divider />
            <Text fontWeight="semibold" fontSize="sm">Line Items</Text>

            {loadingItems ? (
              <Spinner size="sm" />
            ) : (
              <VStack align="stretch" spacing={3}>
                {lines.map((l) => (
                  <Box key={l.key} p={3} border="1px" borderColor="gray.200" _dark={{ borderColor: 'gray.600' }} borderRadius="md">
                    <HStack align="start" spacing={2}>
                      <Box flex={2}>
                        <SearchableSelect
                          value={l.itemId}
                          onChange={(v) => updateLine(l.key, { itemId: v })}
                          options={items.map((i) => ({ _id: i._id, name: i.name, badge: i.sku || undefined }))}
                          placeholder="Search item..."
                          allowClear
                        />
                      </Box>
                      <Box flex={1}>
                        <NumberInput size="md" min={1} value={l.quantity} onChange={(v) => updateLine(l.key, { quantity: v })}>
                          <NumberInputField placeholder="Qty" />
                        </NumberInput>
                      </Box>
                      <Box flex={1}>
                        <NumberInput size="md" min={0} value={l.unitCost} onChange={(v) => updateLine(l.key, { unitCost: v })}>
                          <NumberInputField placeholder="Unit € (optional)" />
                        </NumberInput>
                      </Box>
                      <IconButton
                        icon={<HailerXSmall />} aria-label="Remove line" size="sm" variant="ghost"
                        onClick={() => removeLine(l.key)} isDisabled={lines.length === 1}
                      />
                    </HStack>
                  </Box>
                ))}
                <Button size="sm" variant="outline" onClick={addLine} alignSelf="start">+ Add Line</Button>
              </VStack>
            )}

            <FormControl>
              <FormLabel fontSize="sm">Notes</FormLabel>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </FormControl>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={handleClose}>Cancel</Button>
          <Button variant="outline" mr={3} onClick={() => void handleSubmit(false)} isDisabled={submitting}>
            Place Order Now
          </Button>
          <Button colorScheme="blue" onClick={() => void handleSubmit(true)} isLoading={submitting}>
            Save as Draft
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
