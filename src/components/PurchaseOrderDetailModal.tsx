import { useEffect, useState } from 'react';
import {
  Badge, Box, Button, Divider, Flex, HStack, Modal, ModalBody, ModalCloseButton,
  ModalContent, ModalHeader, ModalOverlay, NumberInput, NumberInputField, Spinner,
  Table, Tbody, Td, Text, Th, Thead, Tr, useColorModeValue, useToast,
} from '@chakra-ui/react';
import { ActivityFieldValue } from '@hailer/app-sdk';
import { useApp } from '../hailer/use-app';
import {
  PurchaseOrderRow, PurchaseOrderLineRow, parseInsight,
  INSIGHT_PO_LINES, PO_PHASE_RECEIVED, PO_PHASE_PARTIALLY_RECEIVED,
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

export default function PurchaseOrderDetailModal({ order, onClose, onChanged }: Props) {
  const { hailer } = useApp();
  const toast = useToast();

  const [lines, setLines] = useState<PurchaseOrderLineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptQty, setAcceptQty] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const theadBg = useColorModeValue('gray.50', 'gray.800');

  function load() {
    if (!order) return;
    setLoading(true);
    hailer!.insight.data(INSIGHT_PO_LINES, { update: true })
      .then((data) => {
        const all = parseInsight<PurchaseOrderLineRow>(data);
        const forOrder = all.filter((l) => l.parentOrderId === order.id);
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

  useEffect(() => { load(); }, [order?.id]);

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
      await hailer!.activity.create(STOCK_TXN_WORKFLOW, [{
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

      // 4. Roll the header phase forward based on remaining lines.
      const updatedLines = lines.map((l) => (l.id === line.id ? { ...l, phase: 'Received', quantityReceived: qty } : l));
      const stillPending = updatedLines.some((l) => l.phase === 'Pending');
      const anyReceived = updatedLines.some((l) => l.phase === 'Received');
      if (order) {
        if (!stillPending && anyReceived) {
          await hailer!.activity.update([{ _id: order.id, phaseId: PO_PHASE_RECEIVED }], {});
        } else if (anyReceived) {
          await hailer!.activity.update([{ _id: order.id, phaseId: PO_PHASE_PARTIALLY_RECEIVED }], {});
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
          <Divider mb={4} />

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
                      <Td isNumeric>{l.quantityOrdered ?? '—'}</Td>
                      <Td isNumeric>{l.unitCost ? fmtEUR(l.unitCost) : '—'}</Td>
                      <Td isNumeric>{l.lineTotal ? fmtEUR(l.lineTotal) : '—'}</Td>
                      <Td>
                        <Badge colorScheme={PHASE_COLOR[l.phase] || 'gray'} fontSize="xs">
                          {l.phase === 'Received' ? `Received (${l.quantityReceived ?? l.quantityOrdered})` : l.phase}
                        </Badge>
                      </Td>
                      <Td>
                        {l.phase === 'Pending' && (
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
