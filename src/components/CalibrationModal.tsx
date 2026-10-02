import { useRef, useState } from 'react';
import {
  Alert, AlertIcon, Box, Button, FormControl, FormLabel, Input, Modal, ModalBody,
  ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay,
  Text, VStack, useToast, Icon,
} from '@chakra-ui/react';
import { ActivityFieldValue } from '@hailer/app-sdk';
import { useApp } from '../hailer/use-app';
import { HailerUploadCloud } from '../hailer/theme/icons/HailerUploadCloud';
import {
  SU_CALIBRATION_DATE, SU_CALIBRATION_CERT, SU_INVENTORY_ITEM,
  PHASE_AVAILABLE, CALIBRATED_SKU_BY_TYPE,
} from './sensorConstants';
import { adjustInventoryQty } from './inventorySync';

function toDateInputValue(ms?: number | null): string {
  return ms ? new Date(ms).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
}
function dateInputToMs(v: string): number {
  return v ? new Date(v).getTime() : Date.now();
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  unitId: string | null;
  unitName: string;
  sensorType: string;
  /** The unit's current Inventory Item link before this calibration is applied. */
  currentInventoryItemId: string | null;
  /** true = first calibration (New -> Available), false = recalibration (Out for Recalibration -> Available) */
  isFirstCalibration: boolean;
}

export default function CalibrationModal({
  isOpen, onClose, onSuccess, unitId, unitName, sensorType, currentInventoryItemId, isFirstCalibration,
}: Props) {
  const { hailer } = useApp();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [date, setDate] = useState(toDateInputValue());
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setDate(toDateInputValue());
    setFile(null);
    setError(null);
  }
  function handleClose() { reset(); onClose(); }

  async function handleSubmit() {
    if (!unitId) return;
    if (!date) { setError('Enter the calibration date.'); return; }

    setSubmitting(true);
    setError(null);
    try {
      let certificateFileId: string | undefined;
      if (file) {
        certificateFileId = await hailer!.file.upload(file, file.name, {});
      }

      const fields: Record<string, ActivityFieldValue> = {
        [SU_CALIBRATION_DATE]: dateInputToMs(date),
      };
      if (certificateFileId) fields[SU_CALIBRATION_CERT] = certificateFileId;

      // First calibration switches the linked Inventory Database record from
      // the "New" SKU to the "Calibrated" SKU for this sensor type — it never
      // switches back, even on later recalibration cycles.
      const calibratedSku = CALIBRATED_SKU_BY_TYPE[sensorType];
      if (isFirstCalibration && calibratedSku) {
        fields[SU_INVENTORY_ITEM] = calibratedSku;
      }

      await hailer!.activity.update([{
        _id: unitId,
        phaseId: PHASE_AVAILABLE,
        fields,
      }], {});

      // Quantity on Hand sync: a unit moving to Available counts as on-hand
      // against the Calibrated SKU. First calibration also moves it OFF the
      // New SKU's on-hand count (it's leaving New stock for good).
      if (isFirstCalibration) {
        if (currentInventoryItemId) await adjustInventoryQty(hailer!, currentInventoryItemId, -1);
        if (calibratedSku) await adjustInventoryQty(hailer!, calibratedSku, 1);
      } else {
        // Recalibration: already on the Calibrated SKU, just back on hand.
        if (currentInventoryItemId) await adjustInventoryQty(hailer!, currentInventoryItemId, 1);
      }

      toast({
        title: isFirstCalibration ? 'Marked as calibrated' : 'Recalibration complete',
        description: `${unitName} is now Available.`,
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
        <ModalHeader>{isFirstCalibration ? 'Mark Calibrated' : 'Recalibration Complete'}</ModalHeader>
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
              <FormLabel fontSize="sm">Calibration Date</FormLabel>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </FormControl>

            <FormControl>
              <FormLabel fontSize="sm">Calibration Certificate</FormLabel>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/*"
                style={{ display: 'none' }}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <Button
                size="sm" variant="outline" width="100%"
                leftIcon={<Icon as={HailerUploadCloud} />}
                onClick={() => fileInputRef.current?.click()}
              >
                {file ? file.name : 'Upload certificate'}
              </Button>
            </FormControl>

            {isFirstCalibration && (
              <Box bg="blue.50" _dark={{ bg: 'blue.900' }} p={3} borderRadius="md">
                <Text fontSize="xs">
                  This will switch the linked Inventory Item to the Calibrated SKU for
                  "{sensorType}" and move this unit to Available.
                </Text>
              </Box>
            )}
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={handleClose}>Cancel</Button>
          <Button colorScheme="green" onClick={handleSubmit} isLoading={submitting}>
            Mark Available
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
