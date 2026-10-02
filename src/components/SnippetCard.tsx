import { Badge, Box, Divider, HStack, SimpleGrid, Text, VStack, useColorModeValue } from '@chakra-ui/react';
import { ReactNode } from 'react';

export interface StatItem { label: string; value: ReactNode; }

interface SnippetCardProps {
  accentColor?: string;       // top border accent, e.g. 'orange.400'
  eyebrow?: string;           // small code/id line, top-left
  badge?: { text: string; colorScheme: string };
  title: string;
  subtitle?: string;
  stats?: StatItem[];         // main 2-column grid
  footerStats?: StatItem[];   // small bottom row
  moreCount?: number;         // "+N more" footer link
  moreLabel?: string;
  onClick?: () => void;
  onMoreClick?: () => void;
}

// Matches the Hailer activity-card look used across other apps — accent stripe, eyebrow +
// badge header row, title/subtitle, a 2-column stat grid, and an optional small footer row.
// Reused on Overview so each KPI gets a real preview instead of just a number.
export default function SnippetCard({
  accentColor = 'gray.400', eyebrow, badge, title, subtitle, stats, footerStats,
  moreCount, moreLabel = 'more', onClick, onMoreClick,
}: SnippetCardProps) {
  const cardBg = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const mutedText = useColorModeValue('gray.500', 'gray.400');

  return (
    <Box
      bg={cardBg} border="1px" borderColor={borderColor} borderRadius="lg" overflow="hidden"
      borderTop="3px solid" borderTopColor={accentColor}
      cursor={onClick ? 'pointer' : undefined}
      transition="all 0.15s ease"
      _hover={onClick ? { shadow: 'md', transform: 'translateY(-2px)' } : undefined}
      onClick={onClick}
    >
      <Box px={4} pt={4} pb={3}>
        <HStack justify="space-between" align="start" mb={1}>
          <Text fontSize="xs" color={mutedText} fontWeight="medium" noOfLines={1}>{eyebrow}</Text>
          {badge && (
            <Badge colorScheme={badge.colorScheme} fontSize="2xs" whiteSpace="nowrap">{badge.text}</Badge>
          )}
        </HStack>
        <Text fontWeight="bold" fontSize="md" noOfLines={1}>{title}</Text>
        {subtitle && <Text fontSize="sm" color={mutedText} noOfLines={1}>{subtitle}</Text>}
      </Box>

      {stats && stats.length > 0 && (
        <>
          <Divider borderColor={borderColor} />
          <SimpleGrid columns={2} spacing={2} px={4} py={3}>
            {stats.map((s, i) => (
              <VStack key={i} align="start" spacing={0}>
                <Text fontSize="xs" color={mutedText}>{s.label}</Text>
                <Text fontSize="sm" fontWeight="medium" noOfLines={1}>{s.value ?? '—'}</Text>
              </VStack>
            ))}
          </SimpleGrid>
        </>
      )}

      {footerStats && footerStats.length > 0 && (
        <>
          <Divider borderColor={borderColor} />
          <SimpleGrid columns={footerStats.length} spacing={2} px={4} py={2}>
            {footerStats.map((s, i) => (
              <VStack key={i} align="start" spacing={0}>
                <Text fontSize="2xs" color={mutedText}>{s.label}</Text>
                <Text fontSize="xs" fontWeight="medium" noOfLines={1}>{s.value ?? '—'}</Text>
              </VStack>
            ))}
          </SimpleGrid>
        </>
      )}

      {typeof moreCount === 'number' && moreCount > 0 && (
        <>
          <Divider borderColor={borderColor} />
          <Box
            px={4} py={2} cursor={onMoreClick ? 'pointer' : undefined}
            onClick={(e) => { e.stopPropagation(); onMoreClick?.(); }}
          >
            <Text fontSize="xs" color={mutedText}>+{moreCount} {moreLabel}</Text>
          </Box>
        </>
      )}
    </Box>
  );
}
