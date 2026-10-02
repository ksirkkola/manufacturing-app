import { useEffect, useState } from 'react';
import {
  Alert, AlertIcon, Button, FormControl, FormLabel, Input, Modal, ModalBody,
  ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay,
  NumberInput, NumberInputField, Select, Spinner, Text, Textarea, VStack, useToast,
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
const STF_BC_ORDER = '6a4debda4d698d6a7fd72fb3';
const STF_NOTES = '6a4debda4d698d6a7fd72fb9';

type LoggableType = 'Returned' | 'Adjusted' | 'Written Off' | 'Sold (Online)';
const TYPES: LoggableType[] = ['Returned', 'Adjusted', 'Written Off', 'Sold (Online)'];

const TYPE_HELP: Record<LoggableType, string> = {
  Returned: 'An item that came back into stock (customer return, unused part returned from a trip/build outside the normal parts-picking flow, etc). Adds back to Quantity on Hand.',
  Adjusted: 'A manual correction after a physical count or other reconciliation. Enter a positive number to increase stock, negative to decrease.',
  'Written Off': 'Stock removed for good — damaged, lost, expired. Subtracts from Quantity on Hand.',
  'Sold (Online)': "A manual entry for an online sale — normally BigCommerce orders log this automatically via Zapier; use this for a one-off sale that didn't come through that automation. Subtracts from Quantity on Hand.",
};

function toDateInputValue(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
function dateInputToMs(v: string): number {
  return v ? new Date(v).getTime() : Date.now();
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

export default function LogStockTransactionModal({ isOpen, onClose, onSuccess }: Props) {
  const { hailer } = useApp();
  const toast = useToast();

  const [items, setItems] = useState<InventoryOption[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [itemId, setItemId] = useState<string | null>(null);
  const [type, setType] = useState<LoggableType>('Returned');
  const [quantity, setQuantity] = useState('');
  const [bcOrder, setBcOrder] = useState('');
  const [notes, setNotes] = useState('');
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
  const isAdjust = type === 'Adjusted';
  // Adjusted allows a signed delta; the other 3 types are always a positive quantity.
  const delta = isAdjust ? (Number(quantity) || 0) : Math.abs(Number(quantity) || 0) * (type === 'Returned' ? 1 : -1);
  const newQty = selectedItem ? Math.max(0, selectedItem.quantityOnHand + delta) : null;

  function reset() {
    setItemId(null);
    setType('Returned');
    setQuantity('');
    setBcOrder('');
    setNotes('');
    setDate(toDateInputValue(Date.now()));
    setError(null);
  }
  function handleClose() { reset(); onClose(); }

  async function handleSubmit() {
    if (!selectedItem) { setError('Pick an item.'); return; }
    const qtyNum = Number(quantity);
    if (!qtyNum || (isAdjust ? qtyNum === 0 : qtyNum <= 0)) {
      setError(isAdjust ? 'Enter a non-zero adjustment amount.' : 'Enter a quantity greater than 0.');
      return;
    }
    if ((type === 'Adjusted' || type === 'Written Off') && !notes.trim()) {
      setError('A reason is required for adjustments and write-offs.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const finalQty = Math.max(0, selectedItem.quantityOnHand + delta);

      // 1. Update Inventory Database's Quantity on Hand.
      await hailer!.activity.update([{
        _id: selectedItem._id,
        fields: { [INV_FIELD_QTY]: finalQty },
      }], {});

      // 2. Record the Stock Transaction (audit trail).
      const direction = delta >= 0 ? 'In' : 'Out';
      const fields: Record<string, ActivityFieldValue> = {
        [STF_TYPE]: type,
        [STF_ITEM]: selectedItem._id,
        [STF_QTY]: Math.abs(delta),
        [STF_DIRECTION]: direction,
        [STF_DATE]: dateInputToMs(date),
      };
      if (selectedItem.sku) fields[STF_SKU] = selectedItem.sku;
      if (type === 'Sold (Online)' && bcOrder.trim()) fields[STF_BC_ORDER] = bcOrder.trim();
      if (notes.trim()) fields[STF_NOTES] = notes.trim();

      await hailer!.activity.create(STOCK_TXN_WORKFLOW, [{
        name: `${type} — ${selectedItem.sku || selectedItem.name}`,
        phaseId: STOCK_TXN_PHASE,
        fields,
      }], {});

      toast({
        title: 'Transaction logged',
        description: `${selectedItem.name}: ${selectedItem.quantityOnHand} → ${finalQty}`,
        status: 'success', duration: 3000, isClosable: true,
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
        <ModalHeader>Log Stock Transaction</ModalHeader>
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
              <FormLabel fontSize="sm">Transaction Type</FormLabel>
              <Select value={type} onChange={(e) => { setType(e.target.value as LoggableType); setQuantity(''); }}>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
              <Text fontSize="xs" color="gray.500" mt={1}>{TYPE_HELP[type]}</Text>
            </FormControl>

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
              <FormLabel fontSize="sm">{isAdjust ? 'Adjustment Amount (+/-)' : 'Quantity'}</FormLabel>
              <NumberInput value={quantity} onChange={(v) => setQuantity(v)}>
                <NumberInputField />
              </NumberInput>
              {selectedItem && quantity !== '' && newQty !== null && (
                <Text fontSize="xs" color={delta >= 0 ? 'green.600' : 'red.600'} mt={1}>
                  New on hand: {selectedItem.quantityOnHand} {delta >= 0 ? '+' : '-'} {Math.abs(delta)} = {newQty}
                </Text>
              )}
            </FormControl>

            <FormControl>
              <FormLabel fontSize="sm">Date</FormLabel>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </FormControl>

            {type === 'Sold (Online)' && (
              <FormControl>
                <FormLabel fontSize="sm">BigCommerce Order # (optional)</FormLabel>
                <Input value={bcOrder} onChange={(e) => setBcOrder(e.target.value)} placeholder="e.g. 10234" />
              </FormControl>
            )}

            <FormControl isRequired={type === 'Adjusted' || type === 'Written Off'}>
              <FormLabel fontSize="sm">
                {type === 'Adjusted' || type === 'Written Off' ? 'Reason' : 'Notes (optional)'}
              </FormLabel>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                placeholder={type === 'Written Off' ? 'e.g. damaged in transit' : type === 'Adjusted' ? 'e.g. physical count correction' : ''} />
            </FormControl>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={handleClose}>Cancel</Button>
          <Button colorScheme="blue" onClick={handleSubmit} isLoading={submitting}>
            Log Transaction
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
