import { useEffect, useState } from 'react';
import {
  Alert, AlertIcon, Badge, Box, Button, HStack, Modal, ModalBody, ModalCloseButton,
  ModalContent, ModalFooter, ModalHeader, ModalOverlay, NumberInput, NumberInputField,
  Spinner, Text, VStack, useToast,
} from '@chakra-ui/react';
import { ActivityFieldValue } from '@hailer/app-sdk';
import { useApp } from '../hailer/use-app';
import SearchableSelect from './SearchableSelect';
import { INSIGHT_INVENTORY } from './purchaseOrderConstants';

// Add a line item to an EXISTING Online Order, Trip / IHS or Work Order — for when something was missed on the initial
// upload, or the customer called in to add to their order. Creates one more Work Order Line
// Item (Pending, linked via Online Order) at a time, so it works like a quick "scan and add"
// tool while someone's packing rather than a full re-edit of the order.
const WO_LINE_ITEM_WORKFLOW = '6a4c9c51b7d11c3c37c9ca90';
const WOLI_PHASE_PENDING    = '6a4c9c94a218e0e0d33d27b4';
const WOLI_INVENTORY_ITEM   = '6a4c9ce502e498c78d7128c2';
const WOLI_PART_NUMBER      = '6a4c9ce502e498c78d7128c8';
const WOLI_QTY_REQUIRED     = '6a4c9ce502e498c78d7128d9';
const WOLI_TRANSACTION_TYPE = '6a4deba698370c6b89ab6417';
const WOLI_ONLINE_ORDER     = '6abd8ad598f64e0d2f10d7c9';
const WOLI_TRIP             = '6a4deba698370c6b89ab6414';
const WOLI_WORK_ORDER       = '6a4c9ce502e498c78d7128bd';

// Which link field + Transaction Type a new line gets, depending on what it's being added to.
export type LineContext = 'online' | 'trip' | 'wo';
const CONTEXT_CONFIG: Record<LineContext, { linkField: string; transactionType: string }> = {
  online: { linkField: WOLI_ONLINE_ORDER, transactionType: 'Sold (Online)' },
  trip:   { linkField: WOLI_TRIP,         transactionType: 'Used on Trip' },
  wo:     { linkField: WOLI_WORK_ORDER,   transactionType: 'Used in Build' },
};

interface InventoryOption { _id: string; name: string; sku: string | null; }

function parseInsight(data: { headers: string[]; rows: unknown[][] }): Record<string, unknown>[] {
  return data.rows.map((row) => {
    const r: Record<string, unknown> = {};
    data.headers.forEach((h, i) => { r[h] = row[i]; });
    return r;
  });
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderName: string;
  onAdded: () => void;
  // Defaults to 'online' (the original use). 'trip' / 'wo' link the new line to a Trip / IHS or Work Order.
  context?: LineContext;
}

export default function AddOrderLineModal({ isOpen, onClose, orderId, orderName, onAdded, context = 'online' }: Props) {
  const cfg = CONTEXT_CONFIG[context];
  const { hailer } = useApp();
  const toast = useToast();

  const [items, setItems] = useState<InventoryOption[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [itemId, setItemId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedCount, setAddedCount] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    setLoadingItems(true);
    setAddedCount(0);
    hailer!.insight.data(INSIGHT_INVENTORY, { update: true })
      .then((data) => {
        const rows = parseInsight(data);
        setItems(rows.map((r) => ({ _id: r.id as string, name: r.name as string, sku: (r.sku as string) || null })));
        setLoadingItems(false);
      })
      .catch((err) => { setError(String(err)); setLoadingItems(false); });
  }, [isOpen, hailer]);

  function reset() {
    setItemId(null);
    setQuantity('1');
    setError(null);
  }
  function handleClose() { reset(); onClose(); }

  async function handleAdd() {
    if (!itemId) { setError('Pick an item.'); return; }
    if (!Number(quantity) || Number(quantity) <= 0) { setError('Quantity must be more than 0.'); return; }

    setAdding(true);
    setError(null);
    try {
      const item = items.find((i) => i._id === itemId);
      const fields: Record<string, ActivityFieldValue> = {
        [cfg.linkField]: orderId,
        [WOLI_INVENTORY_ITEM]: itemId,
        [WOLI_QTY_REQUIRED]: Number(quantity),
        [WOLI_TRANSACTION_TYPE]: cfg.transactionType,
      };
      if (item?.sku) fields[WOLI_PART_NUMBER] = item.sku;

      await hailer!.activity.create(WO_LINE_ITEM_WORKFLOW, [{
        name: `${item?.sku || item?.name || 'Line'} — ${quantity}`,
        phaseId: WOLI_PHASE_PENDING,
        fields,
      }], {});

      toast({ title: 'Item added', description: item?.name, status: 'success', duration: 2000, isClosable: true });
      setAddedCount((c) => c + 1);
      setItemId(null);
      setQuantity('1');
      onAdded();
    } catch (err) {
      setError(String(err));
    }
    setAdding(false);
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Add Item — {orderName}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack align="stretch" spacing={4}>
            {error && (
              <Alert status="error" borderRadius="md" fontSize="sm">
                <AlertIcon />
                {error}
              </Alert>
            )}
            {addedCount > 0 && (
              <HStack>
                <Badge colorScheme="green">{addedCount} added this session</Badge>
                <Text fontSize="xs" color="gray.500">Keep adding, or Done when finished.</Text>
              </HStack>
            )}

            {loadingItems ? (
              <Spinner size="sm" />
            ) : (
              <HStack align="start" spacing={2}>
                <Box flex={2}>
                  <SearchableSelect
                    value={itemId}
                    onChange={(v) => setItemId(v || null)}
                    options={items.map((i) => ({ _id: i._id, name: i.name, badge: i.sku || undefined }))}
                    placeholder="Search item..."
                    allowClear
                  />
                </Box>
                <Box flex={1}>
                  <NumberInput size="md" min={1} value={quantity} onChange={setQuantity}>
                    <NumberInputField placeholder="Qty" />
                  </NumberInput>
                </Box>
              </HStack>
            )}
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={handleClose}>Done</Button>
          <Button colorScheme="blue" onClick={handleAdd} isLoading={adding}>Add Item</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
