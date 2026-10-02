import { useEffect, useState } from 'react';
import {
  Alert, AlertIcon, Button, FormControl, FormLabel, Input, Modal, ModalBody,
  ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay,
  NumberInput, NumberInputField, Spinner, Text, VStack, useToast,
} from '@chakra-ui/react';
import { ActivityFieldValue } from '@hailer/app-sdk';
import { useApp } from '../hailer/use-app';
import SearchableSelect from './SearchableSelect';

// Inventory Database
const INSIGHT_INVENTORY = '6a4dddce6f85b474eebdc1f7';
const INV_FIELD_QTY = '6a0c251a19566c76c8492813';

// Stock Transaction workflow + phase (Posted)
const STOCK_TXN_WORKFLOW = '6a4deba315df0324e505360c';
const STOCK_TXN_PHASE = '6a4debd498370c6b89ab64e9';

// Stock Transaction fields
const STF_TYPE = '6a4debd94d698d6a7fd72f98';
const STF_ITEM = '6a4debd94d698d6a7fd72f9b';
const STF_SKU = '6a4debd94d698d6a7fd72f9e';
const STF_QTY = '6a4debda4d698d6a7fd72fa1';
const STF_DIRECTION = '6a4debda4d698d6a7fd72fa4';
const STF_DATE = '6a4debda4d698d6a7fd72fa7';
const STF_UNIT_COST = '6a4debda4d698d6a7fd72fb6';
const STF_NOTES = '6a4debda4d698d6a7fd72fb9';

/** 'YYYY-MM-DD' → Unix milliseconds */
function dateInputToMs(v: string): number {
  return v ? new Date(v).getTime() : Date.now();
}
/** Unix milliseconds → 'YYYY-MM-DD' */
function toDateInputValue(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

interface InventoryOption {
  _id: string;
  name: string;
  sku: string | null;
  quantityOnHand: number;
}

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
  onSuccess: () => void;
}

// The gap this fills: Stock History only ever showed transactions — there was
// no way to actually LOG a "Received" one. This creates the Stock Transaction
// record AND bumps the Inventory Database's Quantity on Hand in one step,
// same pattern PartsPickingTab already uses for the "Out" side (picking).
export default function ReceiveStockModal({ isOpen, onClose, onSuccess }: Props) {
  const { hailer } = useApp();
  const toast = useToast();

  const [items, setItems] = useState<InventoryOption[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [itemId, setItemId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [poRef, setPoRef] = useState('');
  const [date, setDate] = useState(toDateInputValue(Date.now()));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoadingItems(true);
    hailer!.insight.data(INSIGHT_INVENTORY, { update: true })
      .then((data) => {
        const rows = parseInsight(data);
        setItems(rows.map((r) => ({
          _id: r.id as string,
          name: r.name as string,
          sku: (r.sku as string) || null,
          quantityOnHand: Number(r.quantityOnHand) || 0,
        })));
        setLoadingItems(false);
      })
      .catch((err) => { setError(String(err)); setLoadingItems(false); });
  }, [isOpen, hailer]);

  const selectedItem = items.find((i) => i._id === itemId) || null;
  const qtyNum = Number(quantity) || 0;

  function reset() {
    setItemId(null);
    setQuantity('');
    setUnitCost('');
    setPoRef('');
    setDate(toDateInputValue(Date.now()));
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit() {
    if (!selectedItem) { setError('Pick an item.'); return; }
    if (!qtyNum || qtyNum <= 0) { setError('Enter a quantity greater than 0.'); return; }

    setSubmitting(true);
    setError(null);
    try {
      const newQty = selectedItem.quantityOnHand + qtyNum;

      // 1. Bump Inventory Database's Quantity on Hand.
      await hailer!.activity.update([{
        _id: selectedItem._id,
        fields: { [INV_FIELD_QTY]: newQty },
      }], {});

      // 2. Record the Stock Transaction (audit trail).
      const fields: Record<string, ActivityFieldValue> = {
        [STF_TYPE]: 'Received',
        [STF_ITEM]: selectedItem._id,
        [STF_QTY]: qtyNum,
        [STF_DIRECTION]: 'In',
        [STF_DATE]: dateInputToMs(date),
      };
      if (selectedItem.sku) fields[STF_SKU] = selectedItem.sku;
      if (unitCost) fields[STF_UNIT_COST] = Number(unitCost);
      if (poRef) fields[STF_NOTES] = poRef;

      await hailer!.activity.create(STOCK_TXN_WORKFLOW, [{
        name: `Received — ${selectedItem.sku || selectedItem.name}`,
        phaseId: STOCK_TXN_PHASE,
        fields,
      }], {});

      toast({
        title: 'Stock received',
        description: `${selectedItem.name}: ${selectedItem.quantityOnHand} → ${newQty}`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      onSuccess();
      handleClose();
    } catch (err) {
      setError(String(err));
    }
    setSubmitting(false);
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Log Received Stock</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack align="stretch" spacing={4}>
            {error && (
              <Alert status="error" borderRadius="md" fontSize="sm">
                <AlertIcon />
                {error}
              </Alert>
            )}
            <FormControl isRequired>
              <FormLabel fontSize="sm">Item</FormLabel>
              {loadingItems ? (
                <Spinner size="sm" />
              ) : (
                <SearchableSelect
                  value={itemId}
                  onChange={setItemId}
                  options={items.map((i) => ({ _id: i._id, name: i.name, badge: i.sku || undefined }))}
                  placeholder="Search by name or SKU..."
                  allowClear
                />
              )}
              {selectedItem && (
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Currently on hand: {selectedItem.quantityOnHand}
                </Text>
              )}
            </FormControl>

            <FormControl isRequired>
              <FormLabel fontSize="sm">Quantity Received</FormLabel>
              <NumberInput min={1} value={quantity} onChange={(v) => setQuantity(v)}>
                <NumberInputField />
              </NumberInput>
              {selectedItem && qtyNum > 0 && (
                <Text fontSize="xs" color="green.600" mt={1}>
                  New on hand: {selectedItem.quantityOnHand} + {qtyNum} = {selectedItem.quantityOnHand + qtyNum}
                </Text>
              )}
            </FormControl>

            <FormControl>
              <FormLabel fontSize="sm">Date Received</FormLabel>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </FormControl>

            <FormControl>
              <FormLabel fontSize="sm">Unit Cost (€, optional)</FormLabel>
              <NumberInput min={0} value={unitCost} onChange={(v) => setUnitCost(v)}>
                <NumberInputField />
              </NumberInput>
            </FormControl>

            <FormControl>
              <FormLabel fontSize="sm">PO / Supplier Reference (optional)</FormLabel>
              <Input value={poRef} onChange={(e) => setPoRef(e.target.value)} placeholder="e.g. PO-1234" />
            </FormControl>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={handleClose}>Cancel</Button>
          <Button colorScheme="green" onClick={handleSubmit} isLoading={submitting}>
            Log Received Stock
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
