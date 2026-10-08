import { useCallback, useEffect, useState } from 'react';
import {
  Badge, Box, Button, Flex, HStack, Heading, Modal, ModalBody, ModalCloseButton, ModalContent, ModalHeader,
  ModalOverlay, Spinner, Text, useColorModeValue, VStack, useToast, Tabs, TabList, Tab, TabPanels, TabPanel, Divider,
} from '@chakra-ui/react';
import { fetchInsight } from '../hailer/insight-queue';
import { useApp } from '../hailer/use-app';

// Assembly Steps / Build Log workspace ids
export const INSIGHT_ASSEMBLY_STEPS = '6ac7691ac6b04df9aa0bd24a';
export const INSIGHT_BUILD_LOG = '6ac7691ce6ae4efc16476f8a';
const BUILD_LOG_WORKFLOW = '6ac766dda782e48cd09d8834';
const BUILD_LOG_PHASE = '6ac766dda782e48cd09d8833';
const LOG_FIELD = {
  workOrder: '6ac76773a782e48cd09d90ee',
  date: '6ac76773a782e48cd09d90f3',
  entryType: '6ac76773a782e48cd09d90f6',
  loggedBy: '6ac76773a782e48cd09d90fe',
};
const STEP_FIELD = { completedBy: '6ac76773a782e48cd09d90d8', completedOn: '6ac76773a782e48cd09d90de' };
const STEP_PHASE = {
  todo: '6ac766c9c6b04df9aa0ba238',
  done: '6ac767222c2e4a4f134b6264',
  skipped: '6ac767252c2e4a4f134b62b6',
};

interface StepRow {
  id: string; name: string; phase: string; workOrder: string | null; stepNo: number | null;
  section: string | null; instructions: string | null; completedBy: string | null; completedOn: number | null; notes: string | null;
}
interface LogRow {
  id: string; name: string; created: number | null; workOrder: string | null; logDate: number | null;
  entryType: string | null; details: string | null; loggedBy: string | null;
}

function rowsOf<T>(data: { headers: string[]; rows: unknown[][] }): T[] {
  return data.rows.map(row => {
    const r: Record<string, unknown> = {};
    data.headers.forEach((h, i) => { r[h] = row[i]; });
    return r as unknown as T;
  });
}
const fmt = (sec: number | null) => (sec ? new Date(Number(sec) * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const STEP_COLOR: Record<string, string> = { 'To Do': 'gray', 'In Progress': 'purple', Blocked: 'red', Done: 'green', Skipped: 'gray' };
const LOG_COLOR: Record<string, string> = {
  Progress: 'blue', 'Issue / Defect': 'red', 'Parts / Stock': 'orange', 'Test / Measurement': 'cyan', Communication: 'purple', Other: 'gray',
};

interface Props { workOrderId: string; workOrderName: string; isOpen: boolean; onClose: () => void; onChanged: () => void; }

export default function BuildDetailModal({ workOrderId, workOrderName, isOpen, onClose, onChanged }: Props) {
  const { hailer, user } = useApp();
  const toast = useToast();
  const [steps, setSteps] = useState<StepRow[]>([]);
  const [log, setLog] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const muted = useColorModeValue('gray.500', 'gray.400');
  const rowBorder = useColorModeValue('gray.100', 'gray.600');

  const userName = (id: string | null) => {
    if (!id) return '—';
    const u = user.map[id];
    return u ? `${u.firstname} ${u.lastname}` : '—';
  };

  const load = useCallback(async () => {
    if (!hailer) return;
    setLoading(true);
    try {
      const [s, l] = await Promise.all([fetchInsight(hailer, INSIGHT_ASSEMBLY_STEPS), fetchInsight(hailer, INSIGHT_BUILD_LOG)]);
      setSteps(rowsOf<StepRow>(s).filter(r => r.workOrder === workOrderId).sort((a, b) => Number(a.stepNo ?? 0) - Number(b.stepNo ?? 0)));
      setLog(rowsOf<LogRow>(l).filter(r => r.workOrder === workOrderId));
    } catch (err) {
      toast({ title: 'Could not load the build', description: String(err), status: 'error' });
    }
    setLoading(false);
  }, [hailer, workOrderId, toast]);

  useEffect(() => { if (isOpen) void load(); }, [isOpen, load]);

  async function moveStep(step: StepRow, to: 'todo' | 'done' | 'skipped') {
    if (!hailer) return;
    setBusy(step.id);
    try {
      const fields = to === 'done'
        ? { [STEP_FIELD.completedOn]: Date.now(), ...(user.current?._id ? { [STEP_FIELD.completedBy]: user.current._id } : {}) }
        : undefined;
      await hailer.activity.update([{ _id: step.id, phaseId: STEP_PHASE[to], ...(fields ? { fields } : {}) }], {});
      await load();
      onChanged();
    } catch (err) {
      toast({ title: 'Could not update the step', description: String((err as { msg?: string })?.msg ?? err), status: 'error' });
    }
    setBusy(null);
  }

  async function addLogEntry() {
    if (!hailer) return;
    const created = await hailer.ui.activity.create(BUILD_LOG_WORKFLOW, {
      name: `${workOrderName} - log`,
      phaseId: BUILD_LOG_PHASE,
      fields: {
        [LOG_FIELD.workOrder]: workOrderId,
        [LOG_FIELD.date]: Date.now(),
        [LOG_FIELD.entryType]: 'Progress',
        ...(user.current?._id ? { [LOG_FIELD.loggedBy]: user.current._id } : {}),
      },
    });
    if (created) { await load(); onChanged(); }
  }

  const active = steps.filter(s => s.phase !== 'Skipped');
  const done = active.filter(s => s.phase === 'Done').length;
  const sections = Array.from(new Set(steps.map(s => s.section || 'Other')));

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="3xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <Heading size="md" noOfLines={1}>{workOrderName}</Heading>
          <Text fontSize="sm" fontWeight="normal" color={muted}>
            {active.length ? `${done} / ${active.length} steps done` : 'No checklist yet. It is created when the Work Order moves to Kit Received.'}
          </Text>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          {loading ? <Flex justify="center" py={10}><Spinner size="lg" /></Flex> : (
            <Tabs variant="enclosed" colorScheme="purple">
              <TabList>
                <Tab>Checklist ({done}/{active.length})</Tab>
                <Tab>Daily log ({log.length})</Tab>
              </TabList>
              <TabPanels>
                <TabPanel px={0}>
                  {steps.length === 0 && <Text color={muted}>No steps for this build.</Text>}
                  <VStack align="stretch" spacing={5}>
                    {sections.map(section => (
                      <Box key={section}>
                        <Text fontSize="xs" fontWeight="bold" textTransform="uppercase" color={muted} mb={1}>{section}</Text>
                        {steps.filter(s => (s.section || 'Other') === section).map(s => (
                          <Flex key={s.id} py={2} borderBottom="1px" borderColor={rowBorder} align="start" gap={3}>
                            <Box flex={1} opacity={s.phase === 'Skipped' ? 0.5 : 1}>
                              <HStack>
                                <Text fontWeight="medium" textDecoration={s.phase === 'Done' ? 'line-through' : undefined}>{s.name}</Text>
                                <Badge colorScheme={STEP_COLOR[s.phase] || 'gray'}>{s.phase}</Badge>
                              </HStack>
                              {s.instructions && <Text fontSize="sm" color={muted}>{s.instructions}</Text>}
                              {s.phase === 'Done' && (
                                <Text fontSize="xs" color={muted}>Done {fmt(s.completedOn)} by {userName(s.completedBy)}</Text>
                              )}
                            </Box>
                            <HStack spacing={1} flexShrink={0}>
                              {s.phase === 'Done' || s.phase === 'Skipped' ? (
                                <Button size="xs" variant="ghost" isLoading={busy === s.id} onClick={() => void moveStep(s, 'todo')}>Reopen</Button>
                              ) : (
                                <>
                                  <Button size="xs" colorScheme="green" isLoading={busy === s.id} onClick={() => void moveStep(s, 'done')}>Done</Button>
                                  <Button size="xs" variant="ghost" isLoading={busy === s.id} onClick={() => void moveStep(s, 'skipped')}>Skip</Button>
                                </>
                              )}
                              <Button size="xs" variant="outline" onClick={() => hailer!.ui.activity.open(s.id)}>Open</Button>
                            </HStack>
                          </Flex>
                        ))}
                      </Box>
                    ))}
                  </VStack>
                </TabPanel>

                <TabPanel px={0}>
                  <Flex justify="space-between" align="center" mb={3}>
                    <Text fontSize="sm" color={muted}>What happened each day on this build.</Text>
                    <Button size="sm" colorScheme="purple" onClick={() => void addLogEntry()}>+ Add log entry</Button>
                  </Flex>
                  {log.length === 0 && <Text color={muted}>No log entries yet.</Text>}
                  <VStack align="stretch" spacing={0} divider={<Divider />}>
                    {log.map(e => (
                      <Box key={e.id} py={3}>
                        <HStack mb={1}>
                          <Text fontWeight="semibold" fontSize="sm">{fmt(e.logDate)}</Text>
                          {e.entryType && <Badge colorScheme={LOG_COLOR[e.entryType] || 'gray'}>{e.entryType}</Badge>}
                          <Text fontSize="xs" color={muted}>{userName(e.loggedBy)}</Text>
                        </HStack>
                        <Text fontSize="sm" whiteSpace="pre-wrap">{e.details || e.name}</Text>
                        <Button size="xs" variant="link" mt={1} onClick={() => hailer!.ui.activity.open(e.id)}>Open (attachments)</Button>
                      </Box>
                    ))}
                  </VStack>
                </TabPanel>
              </TabPanels>
            </Tabs>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
