import { createActivities } from '../hailer/employees';
import { useEffect, useRef, useState } from 'react';
import {
  Alert, AlertIcon, Box, Button, Divider, FormControl, FormLabel, HStack, IconButton, Input,
  Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay,
  NumberInput, NumberInputField, Spinner, Text, Textarea, VStack, useToast,
} from '@chakra-ui/react';
import { ActivityFieldValue } from '@hailer/app-sdk';
import { useApp } from '../hailer/use-app';
import SearchableSelect from './SearchableSelect';
import { HailerXSmall } from '../hailer/theme/icons/HailerXSmall';
import { INSIGHT_INVENTORY } from './purchaseOrderConstants';

// Manual entry point for an online order — now the ONLY entry point, since the BigCommerce/
// Zapier automation never reliably decremented Quantity on Hand and is being retired. Creates
// an Online Order header in Pending + one Work Order Line Item per line, also Pending, linked
// back via the Online Order field. The order PDF (packing slip/invoice) attaches straight to
// the header as a file. Picking from there works exactly like any other online order — same
// Pick/Backorder buttons, same inventory deduction + Stock Transaction logging.
const ONLINE_ORDER_WORKFLOW      = '6abd8a83d21d6cf791caf703';
const ONLINE_ORDER_PHASE_PENDING = '6abd8a83d21d6cf791caf702';
const OO_ORDER_NUMBER = '6abd8ad498f64e0d2f10d7ac';
const OO_ORDER_DATE    = '6abd8ad498f64e0d2f10d7af';
const OO_CUSTOMER_NAME = '6abd8ad498f64e0d2f10d7b2';
const OO_NOTES         = '6abd8ad498f64e0d2f10d7b5';

const OO_CLIENT        = '6abd8ccc29b00ac74d90aa88';
const OO_CONTACT       = '6abd8ccc29b00ac74d90aa8b';
const OO_ASSIGNED_TO   = '6abd8ccc29b00ac74d90aa8e';
// Destination Country is a function field on Online Orders — automatically mirrors the
// linked Client's Company Country once saved. Nothing to set here at creation time.

// Three separate named document slots — each a modifier.file:true field storing a
// JSON-stringified array of file IDs (same pattern as Inventory Database's Photo field).
// Field-based files, not the activity's top-level files[] — sidesteps the shape mismatch
// bug that broke the single generic "Order Document" link.
const OO_INVOICE_DOC        = '6abe35b4709fcaff701517e4';
const OO_PACKING_SLIP_DOC   = '6abe35b4709fcaff701517e7';
const OO_SHIPPING_LABEL_DOC = '6abe35b4709fcaff701517eb';

const WO_LINE_ITEM_WORKFLOW = '6a4c9c51b7d11c3c37c9ca90';
const WOLI_PHASE_PENDING    = '6a4c9c94a218e0e0d33d27b4';
const WOLI_INVENTORY_ITEM   = '6a4c9ce502e498c78d7128c2';
const WOLI_PART_NUMBER      = '6a4c9ce502e498c78d7128c8';
const WOLI_QTY_REQUIRED     = '6a4c9ce502e498c78d7128d9';
const WOLI_TRANSACTION_TYPE = '6a4deba698370c6b89ab6417';
const WOLI_ONLINE_ORDER     = '6abd8ad598f64e0d2f10d7c9';

// Customers / Contact persons datasets — single flat phase each
const CUSTOMERS_WORKFLOW     = '6a041d0ffc4db70b8339c891';
const CUSTOMERS_PHASE        = '6a041d0ffc4db70b8339c89c';
const CONTACT_PERSONS_WORKFLOW = '6a041d0ffc4db70b8339c89a';
const CONTACT_PERSONS_PHASE    = '6a041d0ffc4db70b8339c8e5';
const CONTACT_COMPANY_FIELD    = '6a041d0ffc4db70b8339c8e4'; // Contact persons -> Company (Customers)

// ActivityLink read shape varies: {_id,name} on a single link, [{_id,name}] from some list
// endpoints, or a bare id string. Normalize to just the id.
function readLinkId(v: unknown): string | undefined {
  if (Array.isArray(v)) return (v[0] as { _id?: string } | undefined)?._id;
  if (v && typeof v === 'object') return (v as { _id?: string })._id;
  if (typeof v === 'string') return v;
  return undefined;
}

interface InventoryOption { _id: string; name: string; sku: string | null; }
interface NameOption { _id: string; name: string; }
interface ContactOption { _id: string; name: string; companyId: string | null; }

interface LineDraft {
  key: string;
  itemId: string | null;
  quantity: string;
}

function newLine(): LineDraft {
  return { key: Math.random().toString(36).slice(2), itemId: null, quantity: '1' };
}

function toDateInputValue(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
function dateInputToMs(v: string): number | undefined {
  return v ? new Date(v).getTime() : undefined;
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

export default function NewOnlineOrderModal({ isOpen, onClose, onSuccess }: Props) {
  const { hailer, user } = useApp();
  const toast = useToast();

  const [items, setItems] = useState<InventoryOption[]>([]);
  const [customers, setCustomers] = useState<NameOption[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [users, setUsers] = useState<NameOption[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [orderNumber, setOrderNumber] = useState('');
  const [orderDate, setOrderDate] = useState(toDateInputValue(Date.now()));
  const [customerName, setCustomerName] = useState('');
  const [clientId, setClientId] = useState<string | null>(null);
  const [contactId, setContactId] = useState<string | null>(null);
  const [assignedToId, setAssignedToId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([newLine()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Three document slots — each uploads immediately on file select (per hailer-apps-pictures
  // canonical pattern), awaited on submit rather than on change, so a slow upload doesn't
  // block typing. Separate state per slot since each is its own field.
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [invoiceUploading, setInvoiceUploading] = useState(false);
  const invoiceUploadRef = useRef<Promise<string> | null>(null);
  const invoiceInputRef = useRef<HTMLInputElement>(null);

  const [packingSlipFile, setPackingSlipFile] = useState<File | null>(null);
  const [packingSlipUploading, setPackingSlipUploading] = useState(false);
  const packingSlipUploadRef = useRef<Promise<string> | null>(null);
  const packingSlipInputRef = useRef<HTMLInputElement>(null);

  const [shippingLabelFile, setShippingLabelFile] = useState<File | null>(null);
  const [shippingLabelUploading, setShippingLabelUploading] = useState(false);
  const shippingLabelUploadRef = useRef<Promise<string> | null>(null);
  const shippingLabelInputRef = useRef<HTMLInputElement>(null);

  const anyDocUploading = invoiceUploading || packingSlipUploading || shippingLabelUploading;

  useEffect(() => {
    if (!isOpen) return;
    setLoadingItems(true);
    Promise.all([
      hailer!.insight.data(INSIGHT_INVENTORY, { update: true }),
      hailer!.activity.list(CUSTOMERS_WORKFLOW, CUSTOMERS_PHASE, { limit: 200 }),
      hailer!.activity.list(CONTACT_PERSONS_WORKFLOW, CONTACT_PERSONS_PHASE, { limit: 200 }),
      hailer!.user.list(),
    ])
      .then(([data, customerRows, contactRows, userRows]) => {
        const rows = parseInsight(data);
        setItems(rows.map((r) => ({ _id: r.id as string, name: r.name as string, sku: (r.sku as string) || null })));
        setCustomers((customerRows as Array<{ _id: string; name: string }>).map((c) => ({ _id: c._id, name: c.name })));
        setContacts((contactRows as Array<{ _id: string; name: string; fields?: Record<string, unknown> }>).map((c) => ({
          _id: c._id,
          name: c.name,
          companyId: readLinkId(c.fields?.[CONTACT_COMPANY_FIELD]) || null,
        })));
        setUsers((userRows as Array<{ _id: string; firstname?: string; lastname?: string }>).map((u) => ({
          _id: u._id, name: `${u.firstname || ''} ${u.lastname || ''}`.trim() || u._id,
        })));
        setLoadingItems(false);
      })
      .catch((err) => { setError(String(err)); setLoadingItems(false); });
  }, [isOpen, hailer]);

  function reset() {
    setOrderNumber('');
    setOrderDate(toDateInputValue(Date.now()));
    setCustomerName('');
    setClientId(null);
    setContactId(null);
    setAssignedToId(null);
    setNotes('');
    setLines([newLine()]);
    setError(null);
    setInvoiceFile(null); invoiceUploadRef.current = null; if (invoiceInputRef.current) invoiceInputRef.current.value = '';
    setPackingSlipFile(null); packingSlipUploadRef.current = null; if (packingSlipInputRef.current) packingSlipInputRef.current.value = '';
    setShippingLabelFile(null); shippingLabelUploadRef.current = null; if (shippingLabelInputRef.current) shippingLabelInputRef.current.value = '';
  }
  function handleClose() { reset(); onClose(); }

  function handleInvoiceSelected(file: File) {
    setInvoiceFile(file);
    setInvoiceUploading(true);
    invoiceUploadRef.current = hailer!.file.upload(file, file.name, { isPublic: true });
    invoiceUploadRef.current
      .catch((err) => { setError(`Invoice upload failed: ${String(err)}`); return ''; })
      .finally(() => setInvoiceUploading(false));
  }
  function clearInvoice() {
    setInvoiceFile(null);
    invoiceUploadRef.current = null;
    if (invoiceInputRef.current) invoiceInputRef.current.value = '';
  }

  function handlePackingSlipSelected(file: File) {
    setPackingSlipFile(file);
    setPackingSlipUploading(true);
    packingSlipUploadRef.current = hailer!.file.upload(file, file.name, { isPublic: true });
    packingSlipUploadRef.current
      .catch((err) => { setError(`Packing slip upload failed: ${String(err)}`); return ''; })
      .finally(() => setPackingSlipUploading(false));
  }
  function clearPackingSlip() {
    setPackingSlipFile(null);
    packingSlipUploadRef.current = null;
    if (packingSlipInputRef.current) packingSlipInputRef.current.value = '';
  }

  function handleShippingLabelSelected(file: File) {
    setShippingLabelFile(file);
    setShippingLabelUploading(true);
    shippingLabelUploadRef.current = hailer!.file.upload(file, file.name, { isPublic: true });
    shippingLabelUploadRef.current
      .catch((err) => { setError(`Shipping label upload failed: ${String(err)}`); return ''; })
      .finally(() => setShippingLabelUploading(false));
  }
  function clearShippingLabel() {
    setShippingLabelFile(null);
    shippingLabelUploadRef.current = null;
    if (shippingLabelInputRef.current) shippingLabelInputRef.current.value = '';
  }

  // Keep Contact in sync with Client — drop the selection if it belongs to a different
  // company than whatever Client was just picked (handles switching clients mid-form).
  function handleClientChange(v: string) {
    const newClientId = v || null;
    setClientId(newClientId);
    if (newClientId && contactId) {
      const current = contacts.find((c) => c._id === contactId);
      if (current && current.companyId !== newClientId) setContactId(null);
    }
  }

  function updateLine(key: string, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function addLine() { setLines((prev) => [...prev, newLine()]); }
  function removeLine(key: string) { setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev)); }

  const validLines = lines.filter((l) => l.itemId && Number(l.quantity) > 0);

  async function handleSubmit() {
    if (!orderNumber.trim()) { setError('Order # is required.'); return; }
    if (validLines.length === 0) { setError('Add at least one line item with a quantity.'); return; }

    setSubmitting(true);
    setError(null);
    try {
      // Await any in-flight document uploads so each file is ready before the activity is
      // created. These are field values (modifier.file:true — a JSON-stringified array of
      // file IDs), not the activity-level fileIds option, so each document lands in its own
      // named slot instead of one shared attachment list.
      const headerFields: Record<string, ActivityFieldValue> = { [OO_ORDER_NUMBER]: orderNumber.trim() };
      const orderMs = dateInputToMs(orderDate);
      if (orderMs) headerFields[OO_ORDER_DATE] = orderMs;
      if (customerName.trim()) headerFields[OO_CUSTOMER_NAME] = customerName.trim();
      if (clientId) headerFields[OO_CLIENT] = clientId;
      if (contactId) headerFields[OO_CONTACT] = contactId;
      if (assignedToId) headerFields[OO_ASSIGNED_TO] = assignedToId;
      if (notes.trim()) headerFields[OO_NOTES] = notes.trim();

      if (invoiceUploadRef.current) {
        const fileId = await invoiceUploadRef.current;
        if (fileId) headerFields[OO_INVOICE_DOC] = JSON.stringify([fileId]);
      }
      if (packingSlipUploadRef.current) {
        const fileId = await packingSlipUploadRef.current;
        if (fileId) headerFields[OO_PACKING_SLIP_DOC] = JSON.stringify([fileId]);
      }
      if (shippingLabelUploadRef.current) {
        const fileId = await shippingLabelUploadRef.current;
        if (fileId) headerFields[OO_SHIPPING_LABEL_DOC] = JSON.stringify([fileId]);
      }

      // followerIds is what actually drives bell notifications (activity moved/updated) —
      // inviteToDiscussionOnChange / inviteActivityCreator only add people to the discussion,
      // not the follower list. Follow both the assignee AND whoever's uploading this order —
      // the creator needs to know the moment it's marked Fulfilled just as much as the picker does.
      const followerIds = Array.from(new Set([user.current?._id, assignedToId].filter(Boolean))) as string[];
      const created = await createActivities(hailer!, ONLINE_ORDER_WORKFLOW, [{
        name: `Order #${orderNumber.trim()}`,
        phaseId: ONLINE_ORDER_PHASE_PENDING,
        fields: headerFields,
      }], {
        ...(followerIds.length ? { followerIds } : {}),
      });

      const orderId = created?.[0]?._id;
      if (!orderId) throw new Error('Order was not created — check Hailer before retrying.');

      await createActivities(hailer!, WO_LINE_ITEM_WORKFLOW, validLines.map((l) => {
        const item = items.find((i) => i._id === l.itemId);
        const fields: Record<string, ActivityFieldValue> = {
          [WOLI_ONLINE_ORDER]: orderId,
          [WOLI_INVENTORY_ITEM]: l.itemId as string,
          [WOLI_QTY_REQUIRED]: Number(l.quantity),
          [WOLI_TRANSACTION_TYPE]: 'Sold (Online)',
        };
        if (item?.sku) fields[WOLI_PART_NUMBER] = item.sku;
        return {
          name: `${item?.sku || item?.name || 'Line'} — ${l.quantity}`,
          phaseId: WOLI_PHASE_PENDING,
          fields,
        };
      }), {});

      toast({ title: 'Order uploaded', description: `Order #${orderNumber}`, status: 'success', duration: 3000, isClosable: true });
      onSuccess();
      handleClose();
    } catch (err) {
      setError(String(err));
    }
    setSubmitting(false);
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Upload Order</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack align="stretch" spacing={4}>
            {error && (
              <Alert status="error" borderRadius="md" fontSize="sm">
                <AlertIcon />
                {error}
              </Alert>
            )}

            <HStack spacing={3} align="start">
              <FormControl isRequired>
                <FormLabel fontSize="sm">BigCommerce Order #</FormLabel>
                <Input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="e.g. 39" />
              </FormControl>
              <FormControl maxW="220px">
                <FormLabel fontSize="sm">Order Date</FormLabel>
                <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
              </FormControl>
            </HStack>

            <FormControl>
              <FormLabel fontSize="sm">Customer Name (from BigCommerce)</FormLabel>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="raw name/email, optional" />
            </FormControl>

            <HStack spacing={3} align="start">
              <Box flex={1}>
                <FormLabel fontSize="sm">Client</FormLabel>
                <SearchableSelect
                  value={clientId}
                  onChange={handleClientChange}
                  options={customers.map((c) => ({ _id: c._id, name: c.name }))}
                  placeholder="Search client..."
                  allowClear
                />
              </Box>
              <Box flex={1}>
                 <FormLabel fontSize="sm">Contact{clientId ? ` (at ${customers.find((c) => c._id === clientId)?.name || 'client'})` : ''}</FormLabel>
                 <SearchableSelect
                   value={contactId}
                   onChange={(v) => setContactId(v || null)}
                   options={(clientId ? contacts.filter((c) => c.companyId === clientId) : contacts)
                     .map((c) => ({ _id: c._id, name: c.name }))}
                   placeholder={clientId ? 'Search contact at this client...' : 'Search contact (pick a client to filter)...'}
                   allowClear
                 />
               </Box>
            </HStack>

            <Box>
              <FormLabel fontSize="sm">Assigned To</FormLabel>
              <SearchableSelect
                value={assignedToId}
                onChange={(v) => setAssignedToId(v || null)}
                options={users.map((u) => ({ _id: u._id, name: u.name }))}
                placeholder="Search person..."
                allowClear
              />
            </Box>

            <Text fontWeight="semibold" fontSize="sm">Documents</Text>
            <HStack spacing={3} align="start">
              <FormControl>
                <FormLabel fontSize="sm">Invoice</FormLabel>
                {invoiceFile ? (
                  <HStack>
                    <Text fontSize="sm" noOfLines={1}>{invoiceFile.name}</Text>
                    {invoiceUploading && <Spinner size="xs" />}
                    <IconButton icon={<HailerXSmall />} aria-label="Remove file" size="xs" variant="ghost" onClick={clearInvoice} />
                  </HStack>
                ) : (
                  <Input ref={invoiceInputRef} type="file" accept="application/pdf" p={1}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleInvoiceSelected(f); }} />
                )}
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Packing Slip</FormLabel>
                {packingSlipFile ? (
                  <HStack>
                    <Text fontSize="sm" noOfLines={1}>{packingSlipFile.name}</Text>
                    {packingSlipUploading && <Spinner size="xs" />}
                    <IconButton icon={<HailerXSmall />} aria-label="Remove file" size="xs" variant="ghost" onClick={clearPackingSlip} />
                  </HStack>
                ) : (
                  <Input ref={packingSlipInputRef} type="file" accept="application/pdf" p={1}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePackingSlipSelected(f); }} />
                )}
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Shipping Label</FormLabel>
                {shippingLabelFile ? (
                  <HStack>
                    <Text fontSize="sm" noOfLines={1}>{shippingLabelFile.name}</Text>
                    {shippingLabelUploading && <Spinner size="xs" />}
                    <IconButton icon={<HailerXSmall />} aria-label="Remove file" size="xs" variant="ghost" onClick={clearShippingLabel} />
                  </HStack>
                ) : (
                  <Input ref={shippingLabelInputRef} type="file" accept="application/pdf" p={1}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleShippingLabelSelected(f); }} />
                )}
              </FormControl>
            </HStack>

            <Divider />
            <Text fontWeight="semibold" fontSize="sm">Line Items</Text>

            {loadingItems ? (
              <Spinner size="sm" />
            ) : (
              <VStack align="stretch" spacing={3}>
                {lines.map((l) => (
                  <Box key={l.key} p={3} border="1px" borderColor="gray.200" _dark={{ borderColor: 'gray.600' }} borderRadius="md">
                    <HStack align="start" spacing={2}>
                      <Box flex={2}>
                        <SearchableSelect
                          value={l.itemId}
                          onChange={(v) => updateLine(l.key, { itemId: v })}
                          options={items.map((i) => ({ _id: i._id, name: i.name, badge: i.sku || undefined }))}
                          placeholder="Search item..."
                          allowClear
                        />
                      </Box>
                      <Box flex={1}>
                        <NumberInput size="md" min={1} value={l.quantity} onChange={(v) => updateLine(l.key, { quantity: v })}>
                          <NumberInputField placeholder="Qty" />
                        </NumberInput>
                      </Box>
                      <IconButton
                        icon={<HailerXSmall />} aria-label="Remove line" size="sm" variant="ghost"
                        onClick={() => removeLine(l.key)} isDisabled={lines.length === 1}
                      />
                    </HStack>
                  </Box>
                ))}
                <Button size="sm" variant="outline" onClick={addLine} alignSelf="start">+ Add Line</Button>
              </VStack>
            )}

            <FormControl>
              <FormLabel fontSize="sm">Notes</FormLabel>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </FormControl>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={handleClose}>Cancel</Button>
          <Button colorScheme="blue" onClick={handleSubmit} isLoading={submitting || anyDocUploading}>
            Upload Order
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
