// Shared IDs for the Sensors feature (🌡️ Sensor Units + 🌡️ Sensor Usage Log).
// Kept in one place so the New/Calibrated SKU mapping isn't duplicated across
// components. Source of truth for these IDs is workspace/enums.ts.

// Workflows
export const SENSOR_UNITS_WORKFLOW = '6a9fd1091d090e6e8fc47089';
export const SENSOR_USAGE_LOG_WORKFLOW = '6a9fd10a1d090e6e8fc470d2';

// Insights
export const INSIGHT_SENSOR_UNITS = '6a9fd7b59a9ad12d5dd16527';
export const INSIGHT_SENSOR_USAGE_LOG = '6a9fd7c09a9ad12d5dd16534';
export const INSIGHT_TRIPS = '6a4dec164d698d6a7fd73078';
export const INSIGHT_WORK_ORDERS = '6a4ddad5d9b751c8857618a6';

// Inventory Database
export const INV_FIELD_QTY = '6a0c251a19566c76c8492813';

// Sensor Units fields
export const SU_SENSOR_TYPE = '6a9fd17f0429f4bd513a9055';
export const SU_SERIAL_NUMBER = '6a9fd17f0429f4bd513a9058';
export const SU_INVENTORY_ITEM = '6a9fd17f0429f4bd513a905b';
export const SU_CALIBRATION_DATE = '6a9fd17f0429f4bd513a905e';
export const SU_CALIBRATION_CERT = '6a9fd17f0429f4bd513a9061';
export const SU_CURRENTLY_ASSIGNED = '6a9fd17f0429f4bd513a9064';
export const SU_NOTES = '6a9fd17f0429f4bd513a9067';
export const SU_REPAIR_WORK_ORDER = '6aa12ffd01361eeab852ac57';

// Sensor Units phases
export const PHASE_NEW = '6a9fd1091d090e6e8fc47088';
export const PHASE_AVAILABLE = '6a9fd139656b70fa8def7860';
export const PHASE_RESERVED = '6a9fd13b656b70fa8def7881';
export const PHASE_OUT_FOR_RECAL = '6a9fd13d656b70fa8def789e';
export const PHASE_RETIRED = '6a9fd13f656b70fa8def78c1';
export const PHASE_NEEDS_REPAIR = '6aa12ff7d67c1324cca892d5';
export const PHASE_NEEDS_CALIBRATION = '6aa13c4ed67c1324cca8ed06';

// Sensor Usage Log fields
export const SUL_SENSOR_UNIT = '6a9fd17f0429f4bd513a906a';
export const SUL_ASSIGNED_TO = '6a9fd17f0429f4bd513a906d';
export const SUL_DATE_CHECKED_OUT = '6a9fd17f0429f4bd513a9070';
export const SUL_DATE_RETURNED = '6a9fd17f0429f4bd513a9073';

// Sensor Usage Log phases
export const PHASE_IN_USE = '6a9fd10a1d090e6e8fc470ce';
export const PHASE_RETURNED = '6a9fd143656b70fa8def78f0';

export const SENSOR_TYPES = [
  'RH Sensor - Vaisala - OTHER',
  'RH Sensor Rotronic - ISGHP',
  'Wind Sensor - TSI (omni-directional) - MANIKIN',
  'Wind Sensor - TSI (uni-directional) - HOTPLATE',
] as const;

// The "New" Inventory Database SKU each sensor type's units start on.
export const NEW_SKU_BY_TYPE: Record<string, string> = {
  'RH Sensor - Vaisala - OTHER': '6a13f858b1c9c78b48fbbed4',              // E10-00170
  'RH Sensor Rotronic - ISGHP': '6a9fd5e71d090e6e8fc4946e',              // E10-01417
  'Wind Sensor - TSI (omni-directional) - MANIKIN': '6a9fd63c1d090e6e8fc49727', // E10-00387
  'Wind Sensor - TSI (uni-directional) - HOTPLATE': '6a9fd72e1d090e6e8fc49ee9',  // E10-00173
};

// The "Calibrated" Inventory Database SKU a unit switches to on first
// calibration — it never reverts to the New SKU, even on later recalibrations.
export const CALIBRATED_SKU_BY_TYPE: Record<string, string> = {
  'RH Sensor - Vaisala - OTHER': '6a9fd5101d090e6e8fc48eb2',              // E10-00170_C
  'RH Sensor Rotronic - ISGHP': '6a13f858b1c9c78b48fbbede',              // E10-01417_C
  'Wind Sensor - TSI (omni-directional) - MANIKIN': '6a13f858b1c9c78b48fbbef4', // E10-04485
  'Wind Sensor - TSI (uni-directional) - HOTPLATE': '6a13f858b1c9c78b48fbbef2',  // E10-04484
};
