import { Box, Button, Flex } from '@chakra-ui/react';
import { Workflow } from '@hailer/app-sdk';
import { useState } from 'react';

export default function WorkflowList(props: { workflows: Workflow[], select?: (workflow: Workflow) => void }) {
  const [showWorkflows, setShowWorkflows] = useState<boolean>(false);

  const workflows = props.workflows;

  return (
    <Box>
      {!showWorkflows && <Button onClick={() => setShowWorkflows(true)} my={3} colorScheme='green'>Show Workflow List</Button>}
      {showWorkflows && (
        <>
          <Button onClick={() => setShowWorkflows(false)} my={3}>Hide Workflow List</Button>
          {workflows.map(
            (workflow, index) => (
              <Flex key={index} alignItems="center" py={1}>
                <Button onClick={() => { props.select?.(workflow); setShowWorkflows(false); }} mr={2} size='sm' colorScheme='green'>
                  Select
                </Button>
                {workflow.name}
              </Flex>
            )
          )}
        </>
      )}
    </Box>
  );
}
