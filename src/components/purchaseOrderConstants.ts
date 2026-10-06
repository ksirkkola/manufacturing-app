// Shared IDs for the Incoming Stock Orders feature (📦 Incoming Stock Orders +
// 📦 Incoming Stock Order Line). Source of truth is workspace/enums.ts.

// Workflows
export const PO_WORKFLOW = '6aa117a20a9489432633a885';
export const PO_LINE_WORKFLOW = '6aa117a30a9489432633a8ac';

// Insights
export const INSIGHT_PURCHASE_ORDERS = '6aa118ba30f2510e8b409849';
export const INSIGHT_PO_LINES = '6aa118c10a9489432633ae31';
export const INSIGHT_INVENTORY = '6a4dddce6f85b474eebdc1f7';

// Incoming Stock Orders (header) fields
export const PO_SUPPLIER = '6aa1180aed49dd631d4ffc66';
export const PO_ORDER_REFERENCE = '6aa1180bed49dd631d4ffc6a';
export const PO_ORDER_DATE = '6aa1180bed49dd631d4ffc6d';
export const PO_EXPECTED_DELIVERY_DATE = '6aa1180bed49dd631d4ffc70';
export const PO_NOTES = '6aa1180bed49dd631d4ffc73';
export const PO_APPROVED_BY = '6aa7a713da23a46b38d33fea';

// Incoming Stock Orders (header) phases
export const PO_PHASE_DRAFT = '6aa117a20a9489432633a884';
export const PO_PHASE_ORDERED = '6aa117fdd513848848e3c85a';
export const PO_PHASE_PARTIALLY_RECEIVED = '6aa117ffd513848848e3c875';
export const PO_PHASE_RECEIVED = '6aa11802d513848848e3c88f';
export const PO_PHASE_CANCELLED = '6aa11804d513848848e3c8ab';

// Incoming Stock Order Line fields
export const POL_PARENT_ORDER = '6aa1180aed49dd631d4ffc4d';
export const POL_INVENTORY_ITEM = '6aa1180aed49dd631d4ffc51';
export const POL_SKU = '6aa1180aed49dd631d4ffc55';
export const POL_QTY_ORDERED = '6aa1180aed49dd631d4ffc58';
export const POL_QTY_RECEIVED = '6aa1180aed49dd631d4ffc5b';
export const POL_UNIT_COST = '6aa1180aed49dd631d4ffc5e';
export const POL_NOTES = '6aa1180aed49dd631d4ffc61';

// Incoming Stock Order Line phases
export const POL_PHASE_PENDING = '6aa117a30a9489432633a8ab';
export const POL_PHASE_RECEIVED = '6aa117f7d513848848e3c7f7';
export const POL_PHASE_CANCELLED = '6aa117fad513848848e3c826';

// Stock Transaction (audit trail — same workflow the other receiving flows write to)
export const STOCK_TXN_WORKFLOW = '6a4deba315df0324e505360c';
export const STOCK_TXN_PHASE = '6a4debd498370c6b89ab64e9';
export const STF_TYPE = '6a4debd94d698d6a7fd72f98';
export const STF_ITEM = '6a4debd94d698d6a7fd72f9b';
export const STF_SKU = '6a4debd94d698d6a7fd72f9e';
export const STF_QTY = '6a4debda4d698d6a7fd72fa1';
export const STF_DIRECTION = '6a4debda4d698d6a7fd72fa4';
export const STF_DATE = '6a4debda4d698d6a7fd72fa7';
export const STF_NOTES = '6a4debda4d698d6a7fd72fb9';

// Inventory Database
export const INV_FIELD_QTY = '6a0c251a19566c76c8492813';

export interface PurchaseOrderRow {
  id: string;
  name: string;
  phase: string;
  created: number;
  supplier: string | null;
  orderReference: string | null;
  orderDate: number | null;
  expectedDeliveryDate: number | null;
  notes: string | null;
  totalLineItems: number | null;
  totalQtyOrdered: number | null;
  totalQtyReceived: number | null;
  totalOrderValue: number | null;
  approvedBy: string | null;
}

export interface PurchaseOrderLineRow {
  id: string;
  name: string;
  phase: string;
  parentOrderId: string | null;
  inventoryItemId: string | null;
  inventoryName: string | null;
  sku: string | null;
  quantityOrdered: number | null;
  quantityReceived: number | null;
  unitCost: number | null;
  lineTotal: number | null;
  notes: string | null;
}

export function parseInsight<T>(data: { headers: string[]; rows: unknown[][] }): T[] {
  return data.rows.map((row) => {
    const r: Record<string, unknown> = {};
    data.headers.forEach((h, i) => { r[h] = row[i]; });
    return r as unknown as T;
  });
}
