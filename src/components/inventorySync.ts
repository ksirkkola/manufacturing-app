import { HailerApi } from '@hailer/app-sdk';
import { INV_FIELD_QTY } from './sensorConstants';

// Keeps Inventory Database's "Quantity on Hand" in sync with Sensor Unit
// phase moves. "On hand" = usable stock sitting on the shelf: units in New
// phase count against the New SKU, units in Available phase count against
// the Calibrated SKU. Reserved / Out for Recalibration / Retired are
// deliberately excluded — they're earmarked, away being serviced, or gone.
//
// Delta-based (read current, add delta, clamp at 0) rather than a full
// recompute — simple and safe with only 2 people driving all the
// transitions through this app.
export async function adjustInventoryQty(hailer: HailerApi, itemId: string | null | undefined, delta: number): Promise<void> {
  if (!itemId || !delta) return;
  const item = await hailer.activity.get(itemId);
  if (!item) return;
  const current = Number((item.fields as Record<string, unknown>)?.[INV_FIELD_QTY]) || 0;
  const next = Math.max(0, current + delta);
  await hailer.activity.update([{
    _id: itemId,
    fields: { [INV_FIELD_QTY]: next },
  }], {});
}
