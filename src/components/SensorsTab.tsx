import { useEffect, useState } from 'react';
import {
  Box, Badge, Button, Flex, HStack, Select, Spinner, Table, Tab, TabList,
  TabPanel, TabPanels, Tabs, Tbody, Td, Text, Th, Thead, Tr,
  useColorModeValue, useToast,
} from '@chakra-ui/react';
import { fetchInsights } from '../hailer/insight-queue';
import { useApp } from '../hailer/use-app';
import DeleteAlertDialog from './DeleteAlertDialog';
import NewSensorUnitModal from './NewSensorUnitModal';
import CalibrationModal from './CalibrationModal';
import ReserveSensorModal from './ReserveSensorModal';
import SendForRepairModal from './SendForRepairModal';
import SensorStockChart from './SensorStockChart';
import {
  INSIGHT_SENSOR_UNITS, INSIGHT_SENSOR_USAGE_LOG, SENSOR_TYPES,
  SU_CURRENTLY_ASSIGNED, PHASE_AVAILABLE, PHASE_OUT_FOR_RECAL, PHASE_RETIRED,
  PHASE_NEEDS_CALIBRATION, SUL_DATE_RETURNED, PHASE_RETURNED,
} from './sensorConstants';
import { adjustInventoryQty } from './inventorySync';

interface SensorUnitRow {
  id: string;
  name: string;
  phase: string;
  sensorType: string;
  serialNumber: string;
  inventoryItemId: string | null;
  inventorySku: string | null;
  inventoryName: string | null;
  calibrationDate: number | null;
  calibrationCertificate: string | null;
  assignedToName: string | null;
  assignedToId: string | null;
  notes: string | null;
}

interface UsageLogRow {
  id: string;
  name: string;
  phase: string;
  sensorUnitName: string | null;
  sensorType: string | null;
  serialNumber: string | null;
  sensorUnitId: string | null;
  assignedToName: string | null;
  dateCheckedOut: number | null;
  dateReturned: number | null;
  notes: string | null;
}

function parseInsight<T>(data: { headers: string[]; rows: unknown[][] }): T[] {
  return data.rows.map((row) => {
    const r: Record<string, unknown> = {};
    data.headers.forEach((h, i) => { r[h] = row[i]; });
    return r as unknown as T;
  });
}

// Custom date fields come back from insights in SECONDS, not milliseconds.
function fmtDate(sec: number | null): string {
  if (!sec) return '—';
  return new Date(sec * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

const PHASE_COLOR: Record<string, string> = {
  New: 'blue',
  Available: 'green',
  Reserved: 'orange',
  'Needs Calibration': 'yellow',
  'Out for Recalibration': 'red',
  'Needs Repair': 'purple',
  Retired: 'gray',
  'In Use': 'orange',
  Returned: 'gray',
};

interface RefreshProps { refreshKey?: number }

export default function SensorsTab({ refreshKey = 0 }: RefreshProps) {
  const { hailer, inside } = useApp();
  const toast = useToast();

  const [units, setUnits] = useState<SensorUnitRow[]>([]);
  const [usageLog, setUsageLog] = useState<UsageLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [localRefresh, setLocalRefresh] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [showNewUnit, setShowNewUnit] = useState(false);
  const [calibrationTarget, setCalibrationTarget] = useState<SensorUnitRow | null>(null);
  const [isFirstCalibration, setIsFirstCalibration] = useState(true);
  const [reserveTarget, setReserveTarget] = useState<SensorUnitRow | null>(null);
  const [retireTarget, setRetireTarget] = useState<SensorUnitRow | null>(null);
  const [repairTarget, setRepairTarget] = useState<SensorUnitRow | null>(null);

  const cardBg      = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const theadBg     = useColorModeValue('gray.50', 'gray.800');
  const rowHover    = useColorModeValue('gray.50', 'gray.600');

  function refresh() { setLocalRefresh((k) => k + 1); }

  useEffect(() => {
    if (!inside) return;
    setLoading(true);
    fetchInsights(hailer!, [INSIGHT_SENSOR_UNITS, INSIGHT_SENSOR_USAGE_LOG])
    .then(([unitData, logData]) => {
      setUnits(parseInsight<SensorUnitRow>(unitData));
      setUsageLog(parseInsight<UsageLogRow>(logData));
      setLoading(false);
    }).catch((err) => { setError(String(err)); setLoading(false); });
  }, [inside, refreshKey, localRefresh]);

  async function cancelReservation(unit: SensorUnitRow) {
    setBusyId(unit.id);
    try {
      await hailer!.activity.update([{
        _id: unit.id,
        phaseId: PHASE_AVAILABLE,
        fields: { [SU_CURRENTLY_ASSIGNED]: '' },
      }], {});
      // Back on hand — undo the -1 applied when it was reserved.
      if (unit.inventoryItemId) await adjustInventoryQty(hailer!, unit.inventoryItemId, 1);
      toast({ title: 'Reservation cancelled', status: 'info', duration: 2000, isClosable: true });
      refresh();
    } catch (err) {
      toast({ title: 'Error', description: String(err), status: 'error', duration: 4000, isClosable: true });
    }
    setBusyId(null);
  }

  async function returnNeedsCalibration(unit: SensorUnitRow) {
    setBusyId(unit.id);
    try {
      // 1. Move the unit to Needs Calibration (queued — not yet shipped to the
      // vendor) and clear the assignment. No inventory delta: it was already
      // excluded from on-hand while Reserved.
      await hailer!.activity.update([{
        _id: unit.id,
        phaseId: PHASE_NEEDS_CALIBRATION,
        fields: { [SU_CURRENTLY_ASSIGNED]: '' },
      }], {});

      // 2. Close the open Sensor Usage Log entry for this unit, if any.
      const openLog = usageLog.find((l) => l.sensorUnitId === unit.id && l.phase === 'In Use');
      if (openLog) {
        await hailer!.activity.update([{
          _id: openLog.id,
          phaseId: PHASE_RETURNED,
          fields: { [SUL_DATE_RETURNED]: Date.now() },
        }], {});
      }

      toast({ title: 'Flagged as needing calibration', description: unit.name, status: 'warning', duration: 3000, isClosable: true });
      refresh();
    } catch (err) {
      toast({ title: 'Error', description: String(err), status: 'error', duration: 4000, isClosable: true });
    }
    setBusyId(null);
  }

  async function flagNeedsCalibration(unit: SensorUnitRow) {
    setBusyId(unit.id);
    try {
      await hailer!.activity.update([{ _id: unit.id, phaseId: PHASE_NEEDS_CALIBRATION }], {});
      // Leaving on-hand stock directly from Available (-1).
      if (unit.inventoryItemId) await adjustInventoryQty(hailer!, unit.inventoryItemId, -1);
      toast({ title: 'Flagged as needing calibration', description: unit.name, status: 'warning', duration: 3000, isClosable: true });
      refresh();
    } catch (err) {
      toast({ title: 'Error', description: String(err), status: 'error', duration: 4000, isClosable: true });
    }
    setBusyId(null);
  }

  async function shipForCalibration(unit: SensorUnitRow) {
    setBusyId(unit.id);
    try {
      // Just marks it as actually sent to the vendor — already excluded from
      // on-hand since it entered Needs Calibration, so no inventory delta.
      await hailer!.activity.update([{ _id: unit.id, phaseId: PHASE_OUT_FOR_RECAL }], {});
      toast({ title: 'Sent for recalibration', description: unit.name, status: 'warning', duration: 3000, isClosable: true });
      refresh();
    } catch (err) {
      toast({ title: 'Error', description: String(err), status: 'error', duration: 4000, isClosable: true });
    }
    setBusyId(null);
  }

  async function markRepaired(unit: SensorUnitRow) {
    setBusyId(unit.id);
    try {
      await hailer!.activity.update([{ _id: unit.id, phaseId: PHASE_AVAILABLE }], {});
      // Back on hand — repair doesn't require a new calibration date/cert,
      // just undoes the -1 applied when it went in for repair.
      if (unit.inventoryItemId) await adjustInventoryQty(hailer!, unit.inventoryItemId, 1);
      toast({ title: 'Repair complete', description: `${unit.name} is now Available.`, status: 'success', duration: 3000, isClosable: true });
      refresh();
    } catch (err) {
      toast({ title: 'Error', description: String(err), status: 'error', duration: 4000, isClosable: true });
    }
    setBusyId(null);
  }

  async function retireUnit() {
    if (!retireTarget) return;
    setBusyId(retireTarget.id);
    try {
      await hailer!.activity.update([{ _id: retireTarget.id, phaseId: PHASE_RETIRED }], {});
      // Only New/Available units count as on-hand — retiring from Reserved,
      // Needs Calibration, Out for Recalibration, or Needs Repair needs no
      // adjustment, they were already excluded.
      if ((retireTarget.phase === 'New' || retireTarget.phase === 'Available') && retireTarget.inventoryItemId) {
        await adjustInventoryQty(hailer!, retireTarget.inventoryItemId, -1);
      }
      toast({ title: 'Sensor retired', description: retireTarget.name, status: 'info', duration: 2500, isClosable: true });
      refresh();
    } catch (err) {
      toast({ title: 'Error', description: String(err), status: 'error', duration: 4000, isClosable: true });
    }
    setBusyId(null);
    setRetireTarget(null);
  }

  const filteredUnits = units.filter((u) => typeFilter === 'all' || u.sensorType === typeFilter);
  const sortedLog = [...usageLog].sort((a, b) => (b.dateCheckedOut || 0) - (a.dateCheckedOut || 0));

  if (loading) return <Flex justify="center" align="center" h="300px"><Spinner size="xl" /></Flex>;
  if (error)   return <Text color="red.500">Error: {error}</Text>;

  return (
    <Box>
      <Tabs variant="soft-rounded" colorScheme="purple">
        <TabList mb={4}>
          <Tab>Sensor Units</Tab>
          <Tab>Usage History</Tab>
        </TabList>

        <TabPanels>
          {/* Sensor Units */}
          <TabPanel px={0}>
            <Box bg={cardBg} border="1px" borderColor={borderColor} borderRadius="md" p={4} mb={6}>
              <Text fontSize="sm" fontWeight="semibold" mb={2}>Stock by Type & Status</Text>
              <SensorStockChart units={units} />
            </Box>

            <HStack mb={4} spacing={3} flexWrap="wrap" justify="space-between">
              <HStack spacing={3}>
                <Select size="sm" maxW="320px" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                  <option value="all">All Sensor Types</option>
                  {SENSOR_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
                <Text fontSize="sm" color="gray.500">{filteredUnits.length} units</Text>
              </HStack>
              <Button size="sm" colorScheme="blue" onClick={() => setShowNewUnit(true)}>
                + New Sensor Unit
              </Button>
            </HStack>

            <Box overflowX="auto" border="1px" borderColor={borderColor} borderRadius="md">
              <Table variant="simple" size="sm">
                <Thead bg={theadBg}>
                  <Tr>
                    <Th>Type</Th>
                    <Th>Serial</Th>
                    <Th>Status</Th>
                    <Th>Inventory SKU</Th>
                    <Th>Calibration Date</Th>
                    <Th>Assigned To</Th>
                    <Th>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {filteredUnits.map((u) => (
                    <Tr key={u.id} _hover={{ bg: rowHover }} cursor="pointer">
                      <Td onClick={() => hailer!.ui.activity.open(u.id)} maxW="220px">
                        <Text noOfLines={1} fontSize="sm">{u.sensorType}</Text>
                      </Td>
                      <Td onClick={() => hailer!.ui.activity.open(u.id)} fontWeight="medium" whiteSpace="nowrap">
                        {u.serialNumber}
                      </Td>
                      <Td onClick={() => hailer!.ui.activity.open(u.id)}>
                        <Badge colorScheme={PHASE_COLOR[u.phase] || 'gray'}>{u.phase}</Badge>
                      </Td>
                      <Td onClick={() => hailer!.ui.activity.open(u.id)} whiteSpace="nowrap" fontSize="sm">
                        {u.inventorySku || '—'}
                      </Td>
                      <Td onClick={() => hailer!.ui.activity.open(u.id)} whiteSpace="nowrap" fontSize="sm">
                        {fmtDate(u.calibrationDate)}
                      </Td>
                      <Td onClick={() => hailer!.ui.activity.open(u.id)} maxW="180px">
                        <Text noOfLines={1} fontSize="sm">{u.assignedToName || '—'}</Text>
                      </Td>
                      <Td onClick={(e) => e.stopPropagation()} cursor="default">
                        <HStack spacing={2} flexWrap="wrap">
                          {u.phase === 'New' && (
                            <Button size="xs" colorScheme="green" isLoading={busyId === u.id}
                              onClick={() => { setCalibrationTarget(u); setIsFirstCalibration(true); }}>
                              Mark Calibrated
                            </Button>
                          )}
                          {u.phase === 'Available' && (
                            <>
                              <Button size="xs" colorScheme="orange" isLoading={busyId === u.id}
                                onClick={() => setReserveTarget(u)}>
                                Reserve
                              </Button>
                              <Button size="xs" colorScheme="yellow" variant="outline" isLoading={busyId === u.id}
                                onClick={() => flagNeedsCalibration(u)}>
                                Needs Calibration
                              </Button>
                              <Button size="xs" colorScheme="purple" variant="outline" isLoading={busyId === u.id}
                                onClick={() => setRepairTarget(u)}>
                                Send for Repair
                              </Button>
                            </>
                          )}
                          {u.phase === 'Reserved' && (
                            <>
                              <Button size="xs" colorScheme="red" isLoading={busyId === u.id}
                                onClick={() => returnNeedsCalibration(u)}>
                                Return
                              </Button>
                              <Button size="xs" colorScheme="purple" variant="outline" isLoading={busyId === u.id}
                                onClick={() => setRepairTarget(u)}>
                                Send for Repair
                              </Button>
                              <Button size="xs" variant="ghost" isLoading={busyId === u.id}
                                onClick={() => cancelReservation(u)}>
                                Cancel
                              </Button>
                            </>
                          )}
                          {u.phase === 'Needs Calibration' && (
                            <Button size="xs" colorScheme="red" isLoading={busyId === u.id}
                              onClick={() => shipForCalibration(u)}>
                              Ship for Calibration
                            </Button>
                          )}
                          {u.phase === 'Out for Recalibration' && (
                            <Button size="xs" colorScheme="green" isLoading={busyId === u.id}
                              onClick={() => { setCalibrationTarget(u); setIsFirstCalibration(false); }}>
                              Mark Recalibrated
                            </Button>
                          )}
                          {u.phase === 'Needs Repair' && (
                            <Button size="xs" colorScheme="green" isLoading={busyId === u.id}
                              onClick={() => markRepaired(u)}>
                              Mark Repaired
                            </Button>
                          )}
                          {u.phase !== 'Retired' && (
                            <Button size="xs" variant="outline" colorScheme="gray" isLoading={busyId === u.id}
                              onClick={() => setRetireTarget(u)}>
                              Retire
                            </Button>
                          )}
                        </HStack>
                      </Td>
                    </Tr>
                  ))}
                  {filteredUnits.length === 0 && (
                    <Tr><Td colSpan={7}><Text color="gray.500" textAlign="center" py={6}>No sensor units yet.</Text></Td></Tr>
                  )}
                </Tbody>
              </Table>
            </Box>
          </TabPanel>

          {/* Usage History */}
          <TabPanel px={0}>
            <Box overflowX="auto" border="1px" borderColor={borderColor} borderRadius="md">
              <Table variant="simple" size="sm">
                <Thead bg={theadBg}>
                  <Tr>
                    <Th>Sensor</Th>
                    <Th>Type</Th>
                    <Th>Assigned To</Th>
                    <Th>Checked Out</Th>
                    <Th>Returned</Th>
                    <Th>Status</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {sortedLog.map((l) => (
                    <Tr key={l.id} _hover={{ bg: rowHover }}>
                      <Td fontWeight="medium" whiteSpace="nowrap">{l.serialNumber || l.sensorUnitName || '—'}</Td>
                      <Td maxW="220px"><Text noOfLines={1} fontSize="sm">{l.sensorType || '—'}</Text></Td>
                      <Td maxW="180px"><Text noOfLines={1} fontSize="sm">{l.assignedToName || '—'}</Text></Td>
                      <Td whiteSpace="nowrap" fontSize="sm">{fmtDate(l.dateCheckedOut)}</Td>
                      <Td whiteSpace="nowrap" fontSize="sm">{fmtDate(l.dateReturned)}</Td>
                      <Td><Badge colorScheme={PHASE_COLOR[l.phase] || 'gray'}>{l.phase}</Badge></Td>
                    </Tr>
                  ))}
                  {sortedLog.length === 0 && (
                    <Tr><Td colSpan={6}><Text color="gray.500" textAlign="center" py={6}>No usage history yet.</Text></Td></Tr>
                  )}
                </Tbody>
              </Table>
            </Box>
          </TabPanel>
        </TabPanels>
      </Tabs>

      <NewSensorUnitModal
        isOpen={showNewUnit}
        onClose={() => setShowNewUnit(false)}
        onSuccess={refresh}
      />

      <CalibrationModal
        isOpen={!!calibrationTarget}
        onClose={() => setCalibrationTarget(null)}
        onSuccess={refresh}
        unitId={calibrationTarget?.id || null}
        unitName={calibrationTarget?.name || ''}
        sensorType={calibrationTarget?.sensorType || ''}
        currentInventoryItemId={calibrationTarget?.inventoryItemId || null}
        isFirstCalibration={isFirstCalibration}
      />

      <ReserveSensorModal
        isOpen={!!reserveTarget}
        onClose={() => setReserveTarget(null)}
        onSuccess={refresh}
        unitId={reserveTarget?.id || null}
        unitName={reserveTarget?.name || ''}
        inventoryItemId={reserveTarget?.inventoryItemId || null}
      />

      <SendForRepairModal
        isOpen={!!repairTarget}
        onClose={() => setRepairTarget(null)}
        onSuccess={refresh}
        unitId={repairTarget?.id || null}
        unitName={repairTarget?.name || ''}
        inventoryItemId={repairTarget?.inventoryItemId || null}
        wasReserved={repairTarget?.phase === 'Reserved'}
        openUsageLogId={repairTarget ? (usageLog.find((l) => l.sensorUnitId === repairTarget.id && l.phase === 'In Use')?.id || null) : null}
      />

      <DeleteAlertDialog
        isOpen={!!retireTarget}
        onClose={() => setRetireTarget(null)}
        onDelete={retireUnit}
        title="Retire Sensor Unit"
        bodyText={`Retire "${retireTarget?.name}"? This is final — it will no longer appear as available or reservable.`}
        deleteText="Retire"
      />
    </Box>
  );
}
