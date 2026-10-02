import { useEffect, useState } from 'react';
import {
  Alert, AlertIcon, Button, FormControl, FormLabel, Modal, ModalBody,
  ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay,
  Select, Spinner, Text, VStack, useToast,
} from '@chakra-ui/react';
import { useApp } from '../hailer/use-app';
import {
  SU_CURRENTLY_ASSIGNED, PHASE_RESERVED, SENSOR_USAGE_LOG_WORKFLOW, PHASE_IN_USE,
  SUL_SENSOR_UNIT, SUL_ASSIGNED_TO, SUL_DATE_CHECKED_OUT, INSIGHT_TRIPS, INSIGHT_WORK_ORDERS,
} from './sensorConstants';
import { adjustInventoryQty } from './inventorySync';

interface Option { id: string; name: string; }

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
  unitId: string | null;
  unitName: string;
  inventoryItemId: string | null;
}

export default function ReserveSensorModal({ isOpen, onClose, onSuccess, unitId, unitName, inventoryItemId }: Props) {
  const { hailer } = useApp();
  const toast = useToast();

  const [trips, setTrips] = useState<Option[]>([]);
  const [workOrders, setWorkOrders] = useState<Option[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [context, setContext] = useState<'trip' | 'wo'>('trip');
  const [selectedId, setSelectedId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoadingOptions(true);
    Promise.all([
      hailer!.insight.data(INSIGHT_TRIPS, { update: true }),
      hailer!.insight.data(INSIGHT_WORK_ORDERS, { update: true }),
    ]).then(([tripData, woData]) => {
      setTrips(parseInsight(tripData).map((r) => ({ id: r.id as string, name: r.name as string })));
      setWorkOrders(parseInsight(woData).map((r) => ({ id: r.id as string, name: r.name as string })));
      setLoadingOptions(false);
    }).catch((err) => { setError(String(err)); setLoadingOptions(false); });
  }, [isOpen, hailer]);

  function reset() {
    setContext('trip');
    setSelectedId('');
    setError(null);
  }
  function handleClose() { reset(); onClose(); }

  async function handleSubmit() {
    if (!unitId) return;
    if (!selectedId) { setError('Pick a Trip or Work Order.'); return; }

    setSubmitting(true);
    setError(null);
    try {
      // 1. Move the Sensor Unit to Reserved and record who it's assigned to.
      await hailer!.activity.update([{
        _id: unitId,
        phaseId: PHASE_RESERVED,
        fields: { [SU_CURRENTLY_ASSIGNED]: selectedId },
      }], {});

      // 2. Open a Sensor Usage Log entry — the accumulating history.
      await hailer!.activity.create(SENSOR_USAGE_LOG_WORKFLOW, [{
        name: `${unitName} — checked out`,
        phaseId: PHASE_IN_USE,
        fields: {
          [SUL_SENSOR_UNIT]: unitId,
          [SUL_ASSIGNED_TO]: selectedId,
          [SUL_DATE_CHECKED_OUT]: Date.now(),
        },
      }], {});

      // Reserved sensors are earmarked to go out — no longer counted as on-hand.
      if (inventoryItemId) await adjustInventoryQty(hailer!, inventoryItemId, -1);

      toast({ title: 'Sensor reserved', description: unitName, status: 'success', duration: 3000, isClosable: true });
      onSuccess();
      handleClose();
    } catch (err) {
      setError(String(err));
    }
    setSubmitting(false);
  }

  const options = context === 'trip' ? trips : workOrders;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Reserve Sensor</ModalHeader>
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
              <FormLabel fontSize="sm">Reserve For</FormLabel>
              <Select
                size="sm" mb={2}
                value={context}
                onChange={(e) => { setContext(e.target.value as 'trip' | 'wo'); setSelectedId(''); }}
              >
                <option value="trip">Trip / IHS</option>
                <option value="wo">Work Order</option>
              </Select>
              {loadingOptions ? (
                <Spinner size="sm" />
              ) : (
                <Select
                  placeholder="— Select —"
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                >
                  {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </Select>
              )}
            </FormControl>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={handleClose}>Cancel</Button>
          <Button colorScheme="orange" onClick={handleSubmit} isLoading={submitting}>
            Reserve
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
