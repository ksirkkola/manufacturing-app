import { useState } from 'react';
import {
  Alert, AlertIcon, Button, FormControl, FormLabel, Input, Modal, ModalBody,
  ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay,
  Select, VStack, useToast,
} from '@chakra-ui/react';
import { useApp } from '../hailer/use-app';
import {
  SENSOR_UNITS_WORKFLOW, PHASE_NEW, SU_SENSOR_TYPE, SU_SERIAL_NUMBER,
  SU_INVENTORY_ITEM, SENSOR_TYPES, NEW_SKU_BY_TYPE,
} from './sensorConstants';
import { adjustInventoryQty } from './inventorySync';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function NewSensorUnitModal({ isOpen, onClose, onSuccess }: Props) {
  const { hailer } = useApp();
  const toast = useToast();

  const [sensorType, setSensorType] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setSensorType('');
    setSerialNumber('');
    setError(null);
  }
  function handleClose() { reset(); onClose(); }

  async function handleSubmit() {
    if (!sensorType) { setError('Pick a sensor type.'); return; }
    if (!serialNumber.trim()) { setError('Enter the serial number.'); return; }

    setSubmitting(true);
    setError(null);
    try {
      const newSku = NEW_SKU_BY_TYPE[sensorType];
      await hailer!.activity.create(SENSOR_UNITS_WORKFLOW, [{
        name: `${sensorType} — ${serialNumber.trim()}`,
        phaseId: PHASE_NEW,
        fields: {
          [SU_SENSOR_TYPE]: sensorType,
          [SU_SERIAL_NUMBER]: serialNumber.trim(),
          ...(newSku ? { [SU_INVENTORY_ITEM]: newSku } : {}),
        },
      }], {});

      // A new unit sitting in New phase counts as +1 on-hand against the New SKU.
      if (newSku) await adjustInventoryQty(hailer!, newSku, 1);

      toast({ title: 'Sensor unit created', description: serialNumber, status: 'success', duration: 3000, isClosable: true });
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
        <ModalHeader>New Sensor Unit</ModalHeader>
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
              <FormLabel fontSize="sm">Sensor Type</FormLabel>
              <Select placeholder="— Select —" value={sensorType} onChange={(e) => setSensorType(e.target.value)}>
                {SENSOR_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </FormControl>

            <FormControl isRequired>
              <FormLabel fontSize="sm">Serial Number</FormLabel>
              <Input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} placeholder="e.g. HS-014" />
            </FormControl>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={handleClose}>Cancel</Button>
          <Button colorScheme="blue" onClick={handleSubmit} isLoading={submitting}>
            Create
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
