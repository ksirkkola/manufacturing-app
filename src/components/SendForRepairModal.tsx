import { useEffect, useState } from 'react';
import {
  Alert, AlertIcon, Button, FormControl, FormLabel, Modal, ModalBody,
  ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay,
  Select, Spinner, Text, VStack, useToast,
} from '@chakra-ui/react';
import { useApp } from '../hailer/use-app';
import { adjustInventoryQty } from './inventorySync';

// Sensor Units
const SU_REPAIR_WORK_ORDER = '6aa12ffd01361eeab852ac57';
const SU_CURRENTLY_ASSIGNED = '6a9fd17f0429f4bd513a9064';
const PHASE_NEEDS_REPAIR = '6aa12ff7d67c1324cca892d5';

const INSIGHT_WORK_ORDERS = '6a4ddad5d9b751c8857618a6';

// Sensor Usage Log
const PHASE_RETURNED = '6a9fd143656b70fa8def78f0';
const SUL_DATE_RETURNED = '6a9fd17f0429f4bd513a9073';

interface Option { id: string; name: string; }

function parseInsight(data: { headers: string[]; rows: unknown[][] }): Record<string, unknown>[] {
  return data.rows.map((row) => {
    const r: Record<string, unknown> = {};
    data.headers.forEach((h, i) => { r[h] = row[i]; });
    return r;
  });
}

export interface SendForRepairProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  unitId: string | null;
  unitName: string;
  inventoryItemId: string | null;
  /** true if the unit is coming from Reserved — clears the active assignment too and skips the inventory decrement (already excluded while reserved). */
  wasReserved: boolean;
  /** The open Sensor Usage Log entry to close, if this unit was Reserved (checked out). */
  openUsageLogId: string | null;
}

export default function SendForRepairModal({
  isOpen, onClose, onSuccess, unitId, unitName, inventoryItemId, wasReserved, openUsageLogId,
}: SendForRepairProps) {
  const { hailer } = useApp();
  const toast = useToast();

  const [workOrders, setWorkOrders] = useState<Option[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoadingOptions(true);
    hailer!.insight.data(INSIGHT_WORK_ORDERS, { update: true })
      .then((data) => {
        setWorkOrders(parseInsight(data).map((r) => ({ id: r.id as string, name: r.name as string })));
        setLoadingOptions(false);
      })
      .catch((err) => { setError(String(err)); setLoadingOptions(false); });
  }, [isOpen, hailer]);

  function reset() { setSelectedId(''); setError(null); }
  function handleClose() { reset(); onClose(); }

  async function handleSubmit() {
    if (!unitId) return;
    if (!selectedId) { setError('Pick the Work Order handling this repair.'); return; }

    setSubmitting(true);
    setError(null);
    try {
      const fields: Record<string, string> = { [SU_REPAIR_WORK_ORDER]: selectedId };
      if (wasReserved) fields[SU_CURRENTLY_ASSIGNED] = '';

      await hailer!.activity.update([{
        _id: unitId,
        phaseId: PHASE_NEEDS_REPAIR,
        fields,
      }], {});

      // Coming from Available it's leaving on-hand stock (-1). Coming from
      // Reserved it was already excluded, so no further adjustment needed.
      if (!wasReserved && inventoryItemId) await adjustInventoryQty(hailer!, inventoryItemId, -1);

      // Close the open Usage Log entry — it broke mid-use, not a normal return.
      if (wasReserved && openUsageLogId) {
        await hailer!.activity.update([{
          _id: openUsageLogId,
          phaseId: PHASE_RETURNED,
          fields: { [SUL_DATE_RETURNED]: Date.now() },
        }], {});
      }

      toast({ title: 'Sent for repair', description: unitName, status: 'warning', duration: 3000, isClosable: true });
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
        <ModalHeader>Send for Repair</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack align="stretch" spacing={4}>
            <Text fontSize="sm" color="gray.500">{unitName}</Text>
            {error && (
              <Alert status="error" borderRadius="md" fontSize="sm">
                <AlertIcon />
                {error}
              </Alert>
            )}
            <FormControl isRequired>
              <FormLabel fontSize="sm">Repair Work Order</FormLabel>
              <Text fontSize="xs" color="gray.500" mb={2}>
                Repair is done in-house — pick the internal Work Order handling it.
              </Text>
              {loadingOptions ? (
                <Spinner size="sm" />
              ) : (
                <Select
                  placeholder="— Select Work Order —"
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                >
                  {workOrders.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </Select>
              )}
            </FormControl>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={handleClose}>Cancel</Button>
          <Button colorScheme="purple" onClick={handleSubmit} isLoading={submitting}>
            Send for Repair
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
