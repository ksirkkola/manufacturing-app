import { useState } from "react"
import { Line } from 'react-chartjs-2';
import 'chart.js/auto'
import { ChartOptions, ChartData } from 'chart.js';
import { Box, Button, Heading, Text } from "@chakra-ui/react";

const labels = ['January', 'February', 'March', 'April', 'May', 'June', 'July'];

const options: ChartOptions<"line"> = {
    responsive: true,
    plugins: {
        legend: {
            position: 'top' as const,
        },
        title: {
            display: true,
            text: 'Chart.js Line Chart',
        },
    },
};

function generateData(): ChartData<"line"> {
    return {
        labels,
        datasets: [
            {
                label: 'Dataset 1',
                data: labels.map(() => Math.random() * 1000),
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgba(255, 99, 132, 0.5)',
            },
            {
                label: 'Dataset 2',
                data: labels.map(() => Math.random() * 1000),
                borderColor: 'rgb(53, 162, 235)',
                backgroundColor: 'rgba(53, 162, 235, 0.5)',
            },
        ],
    };
}

export default function ChartDemo() {
    const [data, setData] = useState<ChartData<"line">>(generateData);

    return (
        <Box p='0em'>
            <Heading fontSize="xl" padding="0px 0 12px">Chart</Heading>

            <Text fontSize={'sm'} margin={'0 10px 10px 10px'} maxWidth={'40em'}>
                Example using third party library inside Hailer App. Any React libraries can be used to help visualize or interact data from Hailer.
            </Text>
            
            <Box>
                <Line options={options} data={data} />
                <Button onClick={() => setData(generateData())} my={4} colorScheme="blue">Show random data</Button>
            </Box>
        </Box>
    )
}
