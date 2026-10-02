import { useState, useRef, useEffect, useMemo, useCallback, KeyboardEvent } from 'react';
import {
  Box, HStack, IconButton, Input, InputGroup, InputRightElement,
  Popover, PopoverBody, PopoverContent, PopoverTrigger, Text, useColorModeValue,
} from '@chakra-ui/react';
import { HailerLargeChevronDown } from '../hailer/theme/icons/HailerLargeChevronDown';
import { HailerXSmall } from '../hailer/theme/icons/HailerXSmall';

export interface SelectOption {
  _id: string;
  name: string;
  badge?: string;
}

interface SearchableSelectProps {
  value: string | null;
  onChange: (id: string) => void;
  options: SelectOption[];
  placeholder: string;
  isDisabled?: boolean;
  isInvalid?: boolean;
  allowClear?: boolean;
}

// Combobox-style dropdown with inline search — from the hailer-app-primitives
// skill, adapted to use bundled Hailer icons instead of react-icons (not
// installed in this app).
export default function SearchableSelect({
  value, onChange, options, placeholder,
  isDisabled = false, isInvalid = false, allowClear = false,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedOption = useMemo(() => options.find((o) => o._id === value) ?? null, [options, value]);
  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    // Match against the badge too (e.g. SKU) — not just the display name.
    return options.filter(
      (o) => o.name.toLowerCase().includes(q) || (o.badge ?? '').toLowerCase().includes(q),
    );
  }, [options, search]);

  useEffect(() => { setHighlightIndex(0); }, [search, isOpen]);
  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-option-index="${highlightIndex}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [highlightIndex, isOpen]);

  const open = useCallback(() => {
    if (isDisabled) return;
    setIsOpen(true); setSearch('');
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [isDisabled]);
  const close = useCallback(() => { setIsOpen(false); setSearch(''); }, []);
  const select = useCallback((id: string) => { onChange(id); close(); }, [onChange, close]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIndex((i) => Math.min(i + 1, Math.max(0, filtered.length - 1))); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIndex((i) => Math.max(0, i - 1)); return; }
    if (e.key === 'Enter') { e.preventDefault(); const opt = filtered[highlightIndex]; if (opt) select(opt._id); return; }
  }, [filtered, highlightIndex, select, close]);

  const triggerBg = useColorModeValue('white', 'gray.700');
  const triggerBorder = useColorModeValue(isInvalid ? 'red.500' : 'gray.200', isInvalid ? 'red.300' : 'gray.600');
  const hoverBg = useColorModeValue('gray.100', 'gray.600');
  const highlightBg = useColorModeValue('green.50', 'green.900');
  const placeholderColor = useColorModeValue('gray.500', 'gray.400');

  return (
    <Popover isOpen={isOpen} onClose={close} placement="bottom-start" autoFocus={false} matchWidth isLazy>
      <PopoverTrigger>
        <HStack
          as="button" type="button" onClick={() => (isOpen ? close() : open())}
          spacing={0} w="100%" h="40px" px={3}
          bg={triggerBg} border="1px solid" borderColor={triggerBorder} borderRadius="md"
          cursor={isDisabled ? 'not-allowed' : 'pointer'} opacity={isDisabled ? 0.6 : 1}
          _hover={{ borderColor: isDisabled ? triggerBorder : 'gray.300' }} textAlign="left"
        >
          <Text flex={1} noOfLines={1} color={selectedOption ? undefined : placeholderColor} fontSize="md">
            {selectedOption ? selectedOption.name : placeholder}
          </Text>
          {selectedOption?.badge && <Text fontSize="sm" color="subtleText" mr={2}>{selectedOption.badge}</Text>}
          {allowClear && selectedOption && !isDisabled && (
            <IconButton icon={<HailerXSmall />} aria-label="Clear selection" size="xs" variant="ghost"
              onClick={(e) => { e.stopPropagation(); onChange(''); }} mr={1} />
          )}
          <Box color="gray.500"><HailerLargeChevronDown boxSize={4} /></Box>
        </HStack>
      </PopoverTrigger>
      <PopoverContent w="100%">
        <PopoverBody p={2}>
          <InputGroup size="sm" mb={2}>
            <Input ref={inputRef} placeholder="Search..." value={search}
              onChange={(e) => setSearch(e.target.value)} onKeyDown={handleKeyDown} autoFocus />
            {search && (
              <InputRightElement>
                <IconButton icon={<HailerXSmall />} aria-label="Clear search" size="xs" variant="ghost" onClick={() => setSearch('')} />
              </InputRightElement>
            )}
          </InputGroup>
          <Box ref={listRef} maxH="240px" overflowY="auto">
            {filtered.length === 0 ? (
              <Text fontSize="sm" color="subtleText" p={2}>No results</Text>
            ) : (
              filtered.map((opt, idx) => (
                <HStack key={opt._id} data-option-index={idx} px={3} py={2} borderRadius="md" cursor="pointer"
                  bg={idx === highlightIndex ? highlightBg : 'transparent'} _hover={{ bg: hoverBg }}
                  onClick={() => select(opt._id)} spacing={2}>
                  <Text flex={1} fontSize="sm" noOfLines={1}>{opt.name}</Text>
                  {opt.badge && <Text fontSize="xs" color="subtleText">{opt.badge}</Text>}
                </HStack>
              ))
            )}
          </Box>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
}
