import {
  Badge, Box, Heading, HStack, SimpleGrid, Text, VStack, useColorModeValue,
} from '@chakra-ui/react';

interface LegendRow { label: string; color: string; description: string; }

function LegendSection({ title, rows }: { title: string; rows: LegendRow[] }) {
  const cardBg = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  return (
    <Box bg={cardBg} border="1px" borderColor={borderColor} borderRadius="md" p={4}>
      <Heading size="sm" mb={3}>{title}</Heading>
      <VStack align="stretch" spacing={3}>
        {rows.map(r => (
          <HStack key={r.label} align="start" spacing={3}>
            <Badge colorScheme={r.color} minW="110px" textAlign="center" py={1} px={2}
              whiteSpace="nowrap" flexShrink={0}>{r.label}</Badge>
            <Text fontSize="sm" color="gray.600" _dark={{ color: 'gray.300' }} flex="1">{r.description}</Text>
          </HStack>
        ))}
      </VStack>
    </Box>
  );
}

export default function ReferenceTab() {
  const cardBg = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  return (
    <Box>
      <Text color="gray.500" fontSize="sm" mb={6}>
        What the statuses and transaction types across this app actually mean — use this if you're new,
        or if a phase name doesn't make sense at a glance.
      </Text>

      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6} mb={6}>
        <LegendSection
          title="Parts Picking — Work Order / Trip / Online Order Line status"
          rows={[
            { label: 'Pending', color: 'yellow', description: 'Not yet picked from the shelf. Quantity on Hand hasn\u2019t been touched for this line yet.' },
            { label: 'Picked', color: 'green', description: 'Someone clicked Pick — inventory was decremented and a Stock Transaction was logged at that moment.' },
            { label: 'Backordered', color: 'red', description: 'We don\u2019t have enough stock to fulfill this line right now. No inventory change happens until it\u2019s Picked.' },
            { label: 'Not Required', color: 'gray', description: '(Work Orders only) This part turned out not to be needed for the build — no inventory or transaction effect.' },
          ]}
        />

        <LegendSection
          title="Online Order (header) status"
          rows={[
            { label: 'Pending', color: 'yellow', description: 'At least one line item on this order is still Pending.' },
            { label: 'Picked', color: 'blue', description: 'Every line item has been picked — ready to pack and ship. Set automatically, not by hand.' },
            { label: 'Backordered', color: 'red', description: 'At least one line item is Backordered, waiting on a restock. Set automatically.' },
            { label: 'Fulfilled', color: 'green', description: 'Picked, packed, and actually shipped. This one IS manual — click "Mark Order Fulfilled" once the box is out the door.' },
          ]}
        />

        <LegendSection
          title="Purchase Order status"
          rows={[
            { label: 'Draft', color: 'gray', description: 'Being put together, not yet sent to the supplier.' },
            { label: 'Ordered', color: 'blue', description: 'Sent to the supplier, nothing received yet.' },
            { label: 'Partially Received', color: 'orange', description: 'Some line items have arrived, others are still outstanding.' },
            { label: 'Received', color: 'green', description: 'Everything on the order has arrived — Quantity on Hand was bumped for each line.' },
            { label: 'Cancelled', color: 'red', description: 'Supplier couldn\u2019t fulfill it, or it was cancelled before receiving.' },
          ]}
        />

        <LegendSection
          title="Inventory flags"
          rows={[
            { label: 'Reorder Needed', color: 'orange', description: 'Automatic flag: Quantity on Hand is at/below Minimum Stock, or has gone negative (sold more than we had). Recomputes itself — nothing to set by hand.' },
            { label: 'Qty On Hand (Computed)', color: 'gray', description: 'Ground-truth check: sums every Stock Transaction (In minus Out). If this disagrees with the manual Quantity on Hand, something touched inventory outside the normal flows.' },
          ]}
        />

        <LegendSection
          title="Work Order (header) status"
          rows={[
            { label: 'New', color: 'gray', description: 'Work order created, awaiting parts sourcing.' },
            { label: 'Parts Sourcing', color: 'yellow', description: 'Sourcing and ordering the required parts before assembly can start.' },
            { label: 'Assembly', color: 'blue', description: 'Active build or repair in progress.' },
            { label: 'QC / Testing', color: 'blue', description: 'Quality control and testing.' },
            { label: 'Ready to Ship', color: 'cyan', description: 'Build complete, ready for shipment.' },
            { label: 'Shipped', color: 'green', description: 'Shipped to the customer.' },
            { label: 'Complete', color: 'green', description: 'Work order complete — the end state for a normal build.' },
            { label: 'On Hold', color: 'orange', description: 'Paused — waiting on something before work can continue.' },
            { label: 'Sent Out for Repair', color: 'red', description: 'Sent to an external vendor — the repair needs capability we don\u2019t have in-house. Returns to Assembly once it\u2019s back.' },
          ]}
        />

        <LegendSection
          title="Sensor Unit status"
          rows={[
            { label: 'New', color: 'gray', description: 'Received but not yet calibrated — still counts against the \u2018New\u2019 SKU in Inventory.' },
            { label: 'Available', color: 'green', description: 'Calibrated and ready to be reserved — counts against the \u2018Calibrated\u2019 SKU from here on, never reverts to New.' },
            { label: 'Reserved', color: 'blue', description: 'Reserved ahead of time for a specific trip or work order build.' },
            { label: 'Needs Calibration', color: 'yellow', description: 'Due for recalibration and queued — flagged but not yet actually shipped to the external calibration vendor.' },
            { label: 'Out for Recalibration', color: 'orange', description: 'Returned from use and sent out for recalibration — not usable until it comes back with a new calibration date/certificate.' },
            { label: 'Needs Repair', color: 'red', description: 'Broken and being repaired in-house under a Work Order — unlike Out for Recalibration, this isn\u2019t sent to an external vendor.' },
            { label: 'Retired', color: 'gray', description: 'End of life — no longer in service.' },
          ]}
        />
      </SimpleGrid>

      <Box bg={cardBg} border="1px" borderColor={borderColor} borderRadius="md" p={4}>
        <Heading size="sm" mb={3}>Stock Transaction — Transaction Types</Heading>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
          {[
            { label: 'Received', description: 'Stock arrived from a supplier (Purchase Order). Direction: In.' },
            { label: 'Used in Build', description: 'Consumed on an internal Work Order (New Build/Repair/Upgrade/Calibration). Direction: Out.' },
            { label: 'Used on Trip', description: 'Taken along on a Trip / IHS for field service. Direction: Out.' },
            { label: 'Sold (Online)', description: 'Sold through the BigCommerce store, picked against an Online Order. Direction: Out.' },
            { label: 'Returned', description: 'Came back — from a customer, a cancelled build, or an unused trip item. Direction: In.' },
            { label: 'Adjusted', description: 'Manual correction after a physical recount — can be In or Out depending on which way the count moved.' },
            { label: 'Written Off', description: 'Lost, broken, or otherwise removed from stock with no recovery. Direction: Out.' },
          ].map(t => (
            <HStack key={t.label} align="start" spacing={3}>
              <Badge minW="120px" textAlign="center" py={1} px={2} whiteSpace="nowrap" flexShrink={0}>{t.label}</Badge>
              <Text fontSize="sm" color="gray.600" _dark={{ color: 'gray.300' }} flex="1">{t.description}</Text>
            </HStack>
          ))}
        </SimpleGrid>
      </Box>
    </Box>
  );
}
