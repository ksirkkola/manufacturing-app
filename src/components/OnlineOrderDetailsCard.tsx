import { useEffect, useRef, useState } from 'react';
import {
  Alert, AlertIcon, Box, Button, Divider, FormControl, FormLabel, HStack, IconButton, Input,
  Link, NumberInput, NumberInputField, SimpleGrid, Spinner, Text, Textarea, VStack,
  useColorModeValue, useToast,
} from '@chakra-ui/react';
import { ActivityFieldUpdateValue } from '@hailer/app-sdk';
import { useApp } from '../hailer/use-app';
import SearchableSelect from './SearchableSelect';
import { HailerXSmall } from '../hailer/theme/icons/HailerXSmall';

// Full header detail + inline edit for an Online Order, right inside Parts Picking —
// so nobody but an admin ever needs to pop into the native Hailer activity panel just to
// see who it's assigned to, which client it's for, or read the order notes/PDF.
const OO_ORDER_NUMBER = '6abd8ad498f64e0d2f10d7ac';
const OO_ORDER_DATE    = '6abd8ad498f64e0d2f10d7af';
const OO_CUSTOMER_NAME = '6abd8ad498f64e0d2f10d7b2';
const OO_NOTES         = '6abd8ad498f64e0d2f10d7b5';
const OO_CLIENT        = '6abd8ccc29b00ac74d90aa88';
const OO_CONTACT       = '6abd8ccc29b00ac74d90aa8b';
const OO_ASSIGNED_TO   = '6abd8ccc29b00ac74d90aa8e';
const OO_SHIPPING_CARRIER = '6abe2f3b566aa3946a2dd732';
const OO_TRACKING_NUMBER  = '6abe2f3b566aa3946a2dd735';
const OO_SHIPPED_DATE     = '6abe2f3b566aa3946a2dd738';
const OO_SHIPPING_COST    = '6abe2f3b566aa3946a2dd73b';
const OO_BOX_DIMENSIONS   = '6abe3e8af4021af673175ad5';
const OO_BOX_WEIGHT       = '6abe3e8af4021af673175ad9';
// Destination Country is a function field — automatically mirrors the linked Client's
// Company Country. Read-only here; no manual entry, no edit-mode control for it.
const OO_DESTINATION_COUNTRY = '6abe5c8c252e6ca592db2dbf';

// Three separate named document slots — modifier.file:true fields, each storing a
// JSON-stringified array of file IDs (plain strings), same pattern as Inventory Database's
// Photo field. Field-based, not the activity's top-level files[] — that shape proved
// unreliable (live app-sdk returns it differently than the REST API does).
const OO_INVOICE_DOC        = '6abe35b4709fcaff701517e4';
const OO_PACKING_SLIP_DOC   = '6abe35b4709fcaff701517e7';
const OO_SHIPPING_LABEL_DOC = '6abe35b4709fcaff701517eb';

const CUSTOMERS_WORKFLOW       = '6a041d0ffc4db70b8339c891';
const CUSTOMERS_PHASE          = '6a041d0ffc4db70b8339c89c';
const CONTACT_PERSONS_WORKFLOW = '6a041d0ffc4db70b8339c89a';
const CONTACT_PERSONS_PHASE    = '6a041d0ffc4db70b8339c8e5';
const CONTACT_COMPANY_FIELD    = '6a041d0ffc4db70b8339c8e4';

interface NameOption { _id: string; name: string; }
interface ContactOption { _id: string; name: string; companyId: string | null; }

function readLinkId(v: unknown): string | undefined {
  if (Array.isArray(v)) return (v[0] as { _id?: string } | undefined)?._id;
  if (v && typeof v === 'object') return (v as { _id?: string })._id;
  if (typeof v === 'string') return v;
  return undefined;
}
function readLinkName(v: unknown): string | null {
  if (Array.isArray(v)) return (v[0] as { name?: string } | undefined)?.name || null;
  if (v && typeof v === 'object') return (v as { name?: string }).name || null;
  return null;
}
function readUserName(v: unknown, userMap: Record<string, { firstname: string; lastname: string }>): string | null {
  if (!v) return null;
  if (typeof v === 'string') { const u = userMap[v]; return u ? `${u.firstname} ${u.lastname}` : v; }
  if (typeof v === 'object') {
    const o = v as { _id?: string; firstname?: string; lastname?: string };
    if (o.firstname) return `${o.firstname} ${o.lastname || ''}`.trim();
    if (o._id) { const u = userMap[o._id]; return u ? `${u.firstname} ${u.lastname}` : o._id; }
  }
  return null;
}
function toDateInputValue(ms: number | undefined | null): string {
  return ms ? new Date(ms).toISOString().slice(0, 10) : '';
}
function dateInputToMs(v: string): number | undefined {
  return v ? new Date(v).getTime() : undefined;
}
// modifier.file:true fields store a JSON-stringified array of file IDs — parse it, don't
// treat it as one ID. Same helper as InventoryTab's photo field handling.
function firstFileId(raw: unknown): string | undefined {
  if (!raw) return undefined;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) return parsed[0];
  } catch {
    if (typeof raw === 'string') return raw;
  }
  return undefined;
}

interface OrderDetails {
  orderNumber: string;
  orderDate: string;       // YYYY-MM-DD for the date input
  destinationCountry: string; // read-only — function field, mirrors the linked Client's country
  customerName: string;
  clientId: string | null;
  clientName: string | null;
  contactId: string | null;
  contactName: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  notes: string;
  followers: string[];
  shippingCarrier: string;
  trackingNumber: string;
  shippedDate: string;     // YYYY-MM-DD
  shippingCost: string;    // kept as string for the NumberInput control
  boxDimensions: string;
  boxWeight: string;       // kept as string for the NumberInput control
  invoiceFileId: string | null;
  packingSlipFileId: string | null;
  shippingLabelFileId: string | null;
}

interface Props {
  orderId: string;
  orderName: string;
  onChanged?: () => void;
}

export default function OnlineOrderDetailsCard({ orderId, orderName, onChanged }: Props) {
  const { hailer, user } = useApp();
  const toast = useToast();

  const [details, setDetails] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [customers, setCustomers] = useState<NameOption[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [users, setUsers] = useState<NameOption[]>([]);
  const [pickersLoaded, setPickersLoaded] = useState(false);

  // Edit-mode draft state
  const [draft, setDraft] = useState<OrderDetails | null>(null);

  // Three document replacement slots — each uploads immediately on select, awaited on Save.
  const [newInvoiceFile, setNewInvoiceFile] = useState<File | null>(null);
  const [invoiceUploading, setInvoiceUploading] = useState(false);
  const invoiceUploadRef = useRef<Promise<string> | null>(null);
  const invoiceInputRef = useRef<HTMLInputElement>(null);

  const [newPackingSlipFile, setNewPackingSlipFile] = useState<File | null>(null);
  const [packingSlipUploading, setPackingSlipUploading] = useState(false);
  const packingSlipUploadRef = useRef<Promise<string> | null>(null);
  const packingSlipInputRef = useRef<HTMLInputElement>(null);

  const [newShippingLabelFile, setNewShippingLabelFile] = useState<File | null>(null);
  const [shippingLabelUploading, setShippingLabelUploading] = useState(false);
  const shippingLabelUploadRef = useRef<Promise<string> | null>(null);
  const shippingLabelInputRef = useRef<HTMLInputElement>(null);

  const anyDocUploading = invoiceUploading || packingSlipUploading || shippingLabelUploading;

  const cardBg = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const mutedText = useColorModeValue('gray.500', 'gray.400');

  function load() {
    setLoading(true);
    setError(null);
    hailer!.activity.get(orderId)
      .then((a) => {
        if (!a) { setError('Order not found.'); setLoading(false); return; }
        const f = a.fields || {};
        setDetails({
          orderNumber: (f[OO_ORDER_NUMBER] as string) || '',
          orderDate: toDateInputValue(f[OO_ORDER_DATE] as number | undefined),
          destinationCountry: (f[OO_DESTINATION_COUNTRY] as string) || '',
          customerName: (f[OO_CUSTOMER_NAME] as string) || '',
          clientId: readLinkId(f[OO_CLIENT]) || null,
          clientName: readLinkName(f[OO_CLIENT]),
          contactId: readLinkId(f[OO_CONTACT]) || null,
          contactName: readLinkName(f[OO_CONTACT]),
          assignedToId: readLinkId(f[OO_ASSIGNED_TO]) || (typeof f[OO_ASSIGNED_TO] === 'string' ? (f[OO_ASSIGNED_TO] as string) : null),
          assignedToName: readUserName(f[OO_ASSIGNED_TO], user.map),
          notes: (f[OO_NOTES] as string) || '',
          followers: a.followers || [],
          shippingCarrier: (f[OO_SHIPPING_CARRIER] as string) || '',
          trackingNumber: (f[OO_TRACKING_NUMBER] as string) || '',
          shippedDate: toDateInputValue(f[OO_SHIPPED_DATE] as number | undefined),
          shippingCost: f[OO_SHIPPING_COST] != null ? String(f[OO_SHIPPING_COST]) : '',
          boxDimensions: (f[OO_BOX_DIMENSIONS] as string) || '',
          boxWeight: f[OO_BOX_WEIGHT] != null ? String(f[OO_BOX_WEIGHT]) : '',
          invoiceFileId: firstFileId(f[OO_INVOICE_DOC]) || null,
          packingSlipFileId: firstFileId(f[OO_PACKING_SLIP_DOC]) || null,
          shippingLabelFileId: firstFileId(f[OO_SHIPPING_LABEL_DOC]) || null,
        });
        setLoading(false);
      })
      .catch((err) => { setError(String(err)); setLoading(false); });
  }

  useEffect(() => {
    load();
    setEditing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  function loadPickers() {
    if (pickersLoaded) return;
    Promise.all([
      hailer!.activity.list(CUSTOMERS_WORKFLOW, CUSTOMERS_PHASE, { limit: 200 }),
      hailer!.activity.list(CONTACT_PERSONS_WORKFLOW, CONTACT_PERSONS_PHASE, { limit: 200 }),
      hailer!.user.list(),
    ]).then(([customerRows, contactRows, userRows]) => {
      setCustomers((customerRows as Array<{ _id: string; name: string }>).map((c) => ({ _id: c._id, name: c.name })));
      setContacts((contactRows as Array<{ _id: string; name: string; fields?: Record<string, unknown> }>).map((c) => ({
        _id: c._id, name: c.name, companyId: readLinkId(c.fields?.[CONTACT_COMPANY_FIELD]) || null,
      })));
      setUsers((userRows as Array<{ _id: string; firstname?: string; lastname?: string }>).map((u) => ({
        _id: u._id, name: `${u.firstname || ''} ${u.lastname || ''}`.trim() || u._id,
      })));
      setPickersLoaded(true);
    }).catch((err) => setError(String(err)));
  }

  function startEdit() {
    loadPickers();
    setDraft(details);
    setNewInvoiceFile(null); invoiceUploadRef.current = null;
    setNewPackingSlipFile(null); packingSlipUploadRef.current = null;
    setNewShippingLabelFile(null); shippingLabelUploadRef.current = null;
    setEditing(true);
  }
  function cancelEdit() {
    setEditing(false);
    setDraft(null);
    setNewInvoiceFile(null); invoiceUploadRef.current = null; if (invoiceInputRef.current) invoiceInputRef.current.value = '';
    setNewPackingSlipFile(null); packingSlipUploadRef.current = null; if (packingSlipInputRef.current) packingSlipInputRef.current.value = '';
    setNewShippingLabelFile(null); shippingLabelUploadRef.current = null; if (shippingLabelInputRef.current) shippingLabelInputRef.current.value = '';
  }

  function handleInvoiceSelected(file: File) {
    setNewInvoiceFile(file);
    setInvoiceUploading(true);
    invoiceUploadRef.current = hailer!.file.upload(file, file.name, { isPublic: true });
    invoiceUploadRef.current
      .catch((err) => { setError(`Invoice upload failed: ${String(err)}`); return ''; })
      .finally(() => setInvoiceUploading(false));
  }
  function handlePackingSlipSelected(file: File) {
    setNewPackingSlipFile(file);
    setPackingSlipUploading(true);
    packingSlipUploadRef.current = hailer!.file.upload(file, file.name, { isPublic: true });
    packingSlipUploadRef.current
      .catch((err) => { setError(`Packing slip upload failed: ${String(err)}`); return ''; })
      .finally(() => setPackingSlipUploading(false));
  }
  function handleShippingLabelSelected(file: File) {
    setNewShippingLabelFile(file);
    setShippingLabelUploading(true);
    shippingLabelUploadRef.current = hailer!.file.upload(file, file.name, { isPublic: true });
    shippingLabelUploadRef.current
      .catch((err) => { setError(`Shipping label upload failed: ${String(err)}`); return ''; })
      .finally(() => setShippingLabelUploading(false));
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const fields: Record<string, ActivityFieldUpdateValue> = {
        [OO_ORDER_NUMBER]: draft.orderNumber.trim(),
        [OO_CUSTOMER_NAME]: draft.customerName.trim() || null,
        [OO_NOTES]: draft.notes.trim() || null,
        [OO_CLIENT]: draft.clientId,
        [OO_CONTACT]: draft.contactId,
        [OO_ASSIGNED_TO]: draft.assignedToId,
        [OO_SHIPPING_CARRIER]: draft.shippingCarrier.trim() || null,
        [OO_TRACKING_NUMBER]: draft.trackingNumber.trim() || null,
        [OO_SHIPPING_COST]: draft.shippingCost !== '' ? Number(draft.shippingCost) : null,
        [OO_BOX_DIMENSIONS]: draft.boxDimensions.trim() || null,
        [OO_BOX_WEIGHT]: draft.boxWeight !== '' ? Number(draft.boxWeight) : null,
      };
      const dateMs = dateInputToMs(draft.orderDate);
      if (dateMs) fields[OO_ORDER_DATE] = dateMs;
      const shippedMs = dateInputToMs(draft.shippedDate);
      if (shippedMs) fields[OO_SHIPPED_DATE] = shippedMs;

      // Each document is a field value (JSON array of file IDs) — only touch the ones that
      // actually got a new upload this session, leave the rest alone.
      if (invoiceUploadRef.current) {
        const fileId = await invoiceUploadRef.current;
        if (fileId) fields[OO_INVOICE_DOC] = JSON.stringify([fileId]);
      }
      if (packingSlipUploadRef.current) {
        const fileId = await packingSlipUploadRef.current;
        if (fileId) fields[OO_PACKING_SLIP_DOC] = JSON.stringify([fileId]);
      }
      if (shippingLabelUploadRef.current) {
        const fileId = await shippingLabelUploadRef.current;
        if (fileId) fields[OO_SHIPPING_LABEL_DOC] = JSON.stringify([fileId]);
      }

      // followerIds drives bell notifications (activity moved/updated) — not the same as
      // the discussion invite the field itself triggers. Swap old assignee out, new one in.
      // followerIds drives bell notifications — swap the old assignee out / new one in if it
      // changed, and make sure whoever is editing this (the one who'll want to know when it's
      // Fulfilled) is following too. Never touch any OTHER existing follower.
      const existingFollowers = new Set(details?.followers || []);
      const followers: Record<string, true | null> = {};
      if (draft.assignedToId !== details?.assignedToId) {
        if (draft.assignedToId) followers[draft.assignedToId] = true;
        if (details?.assignedToId) followers[details.assignedToId] = null;
      }
      if (user.current?._id && !existingFollowers.has(user.current._id)) {
        followers[user.current._id] = true;
      }
      const hasFollowerChanges = Object.keys(followers).length > 0;

      await hailer!.activity.update([{
        _id: orderId,
        name: `Order #${draft.orderNumber.trim()}`,
        fields,
      }], {
        ...(hasFollowerChanges ? { followers } : {}),
      });

      toast({ title: 'Order updated', status: 'success', duration: 2500, isClosable: true });
      setEditing(false);
      setNewInvoiceFile(null); invoiceUploadRef.current = null;
      setNewPackingSlipFile(null); packingSlipUploadRef.current = null;
      setNewShippingLabelFile(null); shippingLabelUploadRef.current = null;
      load();
      onChanged?.();
    } catch (err) {
      setError(String(err));
    }
    setSaving(false);
  }

  const contactOptions = draft?.clientId ? contacts.filter((c) => c.companyId === draft.clientId) : contacts;

  if (loading) return <HStack py={4}><Spinner size="sm" /><Text fontSize="sm" color={mutedText}>Loading order details…</Text></HStack>;
  if (error && !details) return <Alert status="error" borderRadius="md" fontSize="sm"><AlertIcon />{error}</Alert>;
  if (!details) return null;

  return (
    <Box bg={cardBg} border="1px" borderColor={borderColor} borderRadius="md" p={4} mb={4}>
      {error && (
        <Alert status="error" borderRadius="md" fontSize="sm" mb={3}>
          <AlertIcon />
          {error}
        </Alert>
      )}

      <HStack justify="space-between" mb={3}>
        <Text fontWeight="semibold">{orderName}</Text>
        {!editing ? (
          <Button size="xs" variant="outline" onClick={startEdit}>Edit</Button>
        ) : (
          <HStack>
            <Button size="xs" variant="ghost" onClick={cancelEdit}>Cancel</Button>
            <Button size="xs" colorScheme="blue" onClick={save} isLoading={saving || anyDocUploading}>Save</Button>
          </HStack>
        )}
      </HStack>

      {!editing ? (
        <VStack align="stretch" spacing={3}>
          <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
            <Box><Text fontSize="xs" color={mutedText}>Order Date</Text><Text fontSize="sm" fontWeight="medium">{details.orderDate || '—'}</Text></Box>
            <Box><Text fontSize="xs" color={mutedText}>Customer Name</Text><Text fontSize="sm" fontWeight="medium" noOfLines={1}>{details.customerName || '—'}</Text></Box>
            <Box><Text fontSize="xs" color={mutedText}>Client</Text><Text fontSize="sm" fontWeight="medium" noOfLines={1}>{details.clientName || '—'}</Text></Box>
            <Box><Text fontSize="xs" color={mutedText}>Contact</Text><Text fontSize="sm" fontWeight="medium" noOfLines={1}>{details.contactName || '—'}</Text></Box>
          </SimpleGrid>
          <Box>
            <Text fontSize="xs" color={mutedText}>Assigned To</Text>
            <Text fontSize="sm" fontWeight="medium">{details.assignedToName || '—'}</Text>
          </Box>

          <Text fontSize="xs" fontWeight="semibold" color={mutedText} textTransform="uppercase">Documents</Text>
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
            <Box>
              <Text fontSize="xs" color={mutedText}>Invoice</Text>
              {details.invoiceFileId ? (
                <Link href={`https://api.hailer.com/public/file/${details.invoiceFileId}`} isExternal fontSize="sm" color="blue.400">View Invoice</Link>
              ) : (
                <Text fontSize="sm" color={mutedText}>—</Text>
              )}
            </Box>
            <Box>
              <Text fontSize="xs" color={mutedText}>Packing Slip</Text>
              {details.packingSlipFileId ? (
                <Link href={`https://api.hailer.com/public/file/${details.packingSlipFileId}`} isExternal fontSize="sm" color="blue.400">View Packing Slip</Link>
              ) : (
                <Text fontSize="sm" color={mutedText}>—</Text>
              )}
            </Box>
            <Box>
              <Text fontSize="xs" color={mutedText}>Shipping Label</Text>
              {details.shippingLabelFileId ? (
                <Link href={`https://api.hailer.com/public/file/${details.shippingLabelFileId}`} isExternal fontSize="sm" color="blue.400">View Shipping Label</Link>
              ) : (
                <Text fontSize="sm" color={mutedText}>—</Text>
              )}
            </Box>
          </SimpleGrid>

          <Divider borderColor={borderColor} />
          <Text fontSize="xs" fontWeight="semibold" color={mutedText} textTransform="uppercase">Shipping</Text>
          {details.destinationCountry || details.shippingCarrier || details.trackingNumber || details.shippedDate || details.shippingCost || details.boxDimensions || details.boxWeight ? (
            <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
              <Box><Text fontSize="xs" color={mutedText}>Destination</Text><Text fontSize="sm" fontWeight="medium">{details.destinationCountry || '—'}</Text></Box>
              <Box><Text fontSize="xs" color={mutedText}>Carrier</Text><Text fontSize="sm" fontWeight="medium">{details.shippingCarrier || '—'}</Text></Box>
              <Box><Text fontSize="xs" color={mutedText}>Tracking #</Text><Text fontSize="sm" fontWeight="medium">{details.trackingNumber || '—'}</Text></Box>
              <Box><Text fontSize="xs" color={mutedText}>Shipped Date</Text><Text fontSize="sm" fontWeight="medium">{details.shippedDate || '—'}</Text></Box>
              <Box><Text fontSize="xs" color={mutedText}>Shipping Cost</Text><Text fontSize="sm" fontWeight="medium">{details.shippingCost ? `€${details.shippingCost}` : '—'}</Text></Box>
              <Box><Text fontSize="xs" color={mutedText}>Box Dimensions</Text><Text fontSize="sm" fontWeight="medium">{details.boxDimensions || '—'}</Text></Box>
              <Box><Text fontSize="xs" color={mutedText}>Weight</Text><Text fontSize="sm" fontWeight="medium">{details.boxWeight ? `${details.boxWeight} kg` : '—'}</Text></Box>
            </SimpleGrid>
          ) : (
            <Text fontSize="sm" color={mutedText}>Not shipped yet — add destination, carrier, tracking #, box dimensions/weight, and cost here once it ships.</Text>
          )}

          {details.notes && (
            <Box>
              <Text fontSize="xs" color={mutedText}>Notes</Text>
              <Text fontSize="sm">{details.notes}</Text>
            </Box>
          )}
        </VStack>
      ) : draft && (
        <VStack align="stretch" spacing={3}>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
            <FormControl>
              <FormLabel fontSize="sm">BigCommerce Order #</FormLabel>
              <Input value={draft.orderNumber} onChange={(e) => setDraft({ ...draft, orderNumber: e.target.value })} />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">Order Date</FormLabel>
              <Input type="date" value={draft.orderDate} onChange={(e) => setDraft({ ...draft, orderDate: e.target.value })} />
            </FormControl>
          </SimpleGrid>

          <FormControl>
            <FormLabel fontSize="sm">Customer Name (from BigCommerce)</FormLabel>
            <Input value={draft.customerName} onChange={(e) => setDraft({ ...draft, customerName: e.target.value })} />
          </FormControl>

          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
            <Box>
              <FormLabel fontSize="sm">Client</FormLabel>
              <SearchableSelect
                value={draft.clientId}
                onChange={(v) => {
                  const nextClientId = v || null;
                  const stillValid = draft.contactId && contacts.find((c) => c._id === draft.contactId)?.companyId === nextClientId;
                  setDraft({ ...draft, clientId: nextClientId, contactId: stillValid ? draft.contactId : null });
                }}
                options={customers.map((c) => ({ _id: c._id, name: c.name }))}
                placeholder="Search client..."
                allowClear
              />
            </Box>
            <Box>
              <FormLabel fontSize="sm">Contact</FormLabel>
              <SearchableSelect
                value={draft.contactId}
                onChange={(v) => setDraft({ ...draft, contactId: v || null })}
                options={contactOptions.map((c) => ({ _id: c._id, name: c.name }))}
                placeholder="Search contact..."
                allowClear
              />
            </Box>
          </SimpleGrid>

          <Box>
            <FormLabel fontSize="sm">Assigned To</FormLabel>
            <SearchableSelect
              value={draft.assignedToId}
              onChange={(v) => setDraft({ ...draft, assignedToId: v || null })}
              options={users.map((u) => ({ _id: u._id, name: u.name }))}
              placeholder="Search person..."
              allowClear
            />
          </Box>

          <Divider borderColor={borderColor} />
          <Text fontSize="xs" fontWeight="semibold" color={mutedText} textTransform="uppercase">Shipping</Text>
          <Box>
            <Text fontSize="xs" color={mutedText}>Destination Country</Text>
            <Text fontSize="sm" fontWeight="medium">{draft.destinationCountry || '— (set the Client to pick this up automatically)'}</Text>
          </Box>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
            <FormControl>
              <FormLabel fontSize="sm">Shipping Carrier</FormLabel>
              <Input value={draft.shippingCarrier} onChange={(e) => setDraft({ ...draft, shippingCarrier: e.target.value })} placeholder="e.g. DHL, UPS, Posti" />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">Tracking Number</FormLabel>
              <Input value={draft.trackingNumber} onChange={(e) => setDraft({ ...draft, trackingNumber: e.target.value })} />
            </FormControl>
          </SimpleGrid>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
            <FormControl>
              <FormLabel fontSize="sm">Shipped Date</FormLabel>
              <Input type="date" value={draft.shippedDate} onChange={(e) => setDraft({ ...draft, shippedDate: e.target.value })} />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">Shipping Cost (€)</FormLabel>
              <NumberInput min={0} value={draft.shippingCost} onChange={(v) => setDraft({ ...draft, shippingCost: v })}>
                <NumberInputField placeholder="0.00" />
              </NumberInput>
            </FormControl>
          </SimpleGrid>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
            <FormControl>
              <FormLabel fontSize="sm">Box Dimensions</FormLabel>
              <Input value={draft.boxDimensions} onChange={(e) => setDraft({ ...draft, boxDimensions: e.target.value })} placeholder="e.g. 40 x 30 x 20 cm" />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">Weight (kg)</FormLabel>
              <NumberInput min={0} value={draft.boxWeight} onChange={(v) => setDraft({ ...draft, boxWeight: v })}>
                <NumberInputField placeholder="0.0" />
              </NumberInput>
            </FormControl>
          </SimpleGrid>

          <FormControl>
            <FormLabel fontSize="sm">Documents</FormLabel>
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
              <Box>
                <Text fontSize="xs" color={mutedText} mb={1}>Invoice</Text>
                {newInvoiceFile ? (
                  <HStack>
                    <Text fontSize="sm" noOfLines={1}>{newInvoiceFile.name}</Text>
                    {invoiceUploading && <Spinner size="xs" />}
                    <IconButton icon={<HailerXSmall />} aria-label="Remove file" size="xs" variant="ghost"
                      onClick={() => { setNewInvoiceFile(null); invoiceUploadRef.current = null; if (invoiceInputRef.current) invoiceInputRef.current.value = ''; }} />
                  </HStack>
                ) : (
                  <VStack align="stretch" spacing={1}>
                    {!!details.invoiceFileId && <Text fontSize="2xs" color={mutedText}>Uploaded (replaces current)</Text>}
                    <Input ref={invoiceInputRef} type="file" accept="application/pdf" p={1} size="sm"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleInvoiceSelected(f); }} />
                  </VStack>
                )}
              </Box>
              <Box>
                <Text fontSize="xs" color={mutedText} mb={1}>Packing Slip</Text>
                {newPackingSlipFile ? (
                  <HStack>
                    <Text fontSize="sm" noOfLines={1}>{newPackingSlipFile.name}</Text>
                    {packingSlipUploading && <Spinner size="xs" />}
                    <IconButton icon={<HailerXSmall />} aria-label="Remove file" size="xs" variant="ghost"
                      onClick={() => { setNewPackingSlipFile(null); packingSlipUploadRef.current = null; if (packingSlipInputRef.current) packingSlipInputRef.current.value = ''; }} />
                  </HStack>
                ) : (
                  <VStack align="stretch" spacing={1}>
                    {!!details.packingSlipFileId && <Text fontSize="2xs" color={mutedText}>Uploaded (replaces current)</Text>}
                    <Input ref={packingSlipInputRef} type="file" accept="application/pdf" p={1} size="sm"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePackingSlipSelected(f); }} />
                  </VStack>
                )}
              </Box>
              <Box>
                <Text fontSize="xs" color={mutedText} mb={1}>Shipping Label</Text>
                {newShippingLabelFile ? (
                  <HStack>
                    <Text fontSize="sm" noOfLines={1}>{newShippingLabelFile.name}</Text>
                    {shippingLabelUploading && <Spinner size="xs" />}
                    <IconButton icon={<HailerXSmall />} aria-label="Remove file" size="xs" variant="ghost"
                      onClick={() => { setNewShippingLabelFile(null); shippingLabelUploadRef.current = null; if (shippingLabelInputRef.current) shippingLabelInputRef.current.value = ''; }} />
                  </HStack>
                ) : (
                  <VStack align="stretch" spacing={1}>
                    {!!details.shippingLabelFileId && <Text fontSize="2xs" color={mutedText}>Uploaded (replaces current)</Text>}
                    <Input ref={shippingLabelInputRef} type="file" accept="application/pdf" p={1} size="sm"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleShippingLabelSelected(f); }} />
                  </VStack>
                )}
              </Box>
            </SimpleGrid>
          </FormControl>

          <FormControl>
            <FormLabel fontSize="sm">Notes</FormLabel>
            <Textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={2} />
          </FormControl>
        </VStack>
      )}
    </Box>
  );
}
