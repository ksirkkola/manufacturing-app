import { Bar } from 'react-chartjs-2';
import 'chart.js/auto';
import { ChartData, ChartOptions } from 'chart.js';
import { Box, useColorModeValue } from '@chakra-ui/react';
import { SENSOR_TYPES } from './sensorConstants';

interface UnitLike { sensorType: string; phase: string; }

// Matches the Badge colorScheme used in the units table (blue/green/orange/yellow/red/purple/gray).
const PHASE_ORDER = ['New', 'Available', 'Reserved', 'Needs Calibration', 'Out for Recalibration', 'Needs Repair', 'Retired'] as const;
const PHASE_HEX: Record<(typeof PHASE_ORDER)[number], string> = {
  New: '#4299E1',
  Available: '#48BB78',
  Reserved: '#ED8936',
  'Needs Calibration': '#ECC94B',
  'Out for Recalibration': '#F56565',
  'Needs Repair': '#9F7AEA',
  Retired: '#A0AEC0',
};

// Sensor Type names use " - " as a separator (e.g. "Wind Sensor - TSI
// (omni-directional) - MANIKIN"). Split on the first " - " so the label wraps
// onto 2 readable lines — falls back to an even word-count split otherwise.
function wrapLabel(label: string): string[] {
  const sepIndex = label.indexOf(' - ');
  if (sepIndex !== -1) {
    return [label.slice(0, sepIndex), label.slice(sepIndex + 3)];
  }
  const words = label.split(' ');
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
}

interface Props { units: UnitLike[]; }

export default function SensorStockChart({ units }: Props) {
  const tickColor = useColorModeValue('#4A5568', '#CBD5E0');
  const gridColor = useColorModeValue('#E2E8F0', '#2D3748');

  const data: ChartData<'bar'> = {
    labels: SENSOR_TYPES.map(wrapLabel),
    datasets: PHASE_ORDER.map((phase) => ({
      label: phase,
      backgroundColor: PHASE_HEX[phase],
      data: SENSOR_TYPES.map((type) => units.filter((u) => u.sensorType === type && u.phase === phase).length),
    })),
  };

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { color: tickColor, boxWidth: 12, font: { size: 11 } } },
      title: { display: false },
    },
    scales: {
      x: { stacked: true, ticks: { color: tickColor }, grid: { display: false } },
      y: {
        stacked: true, beginAtZero: true, ticks: { color: tickColor, precision: 0 },
        grid: { color: gridColor },
      },
    },
  };

  return (
    <Box h="260px" mb={6}>
      <Bar data={data} options={options} />
    </Box>
  );
}
