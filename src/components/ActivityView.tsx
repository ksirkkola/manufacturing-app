import { Activity, HailerError, Workflow, WorkflowPhase } from "@hailer/app-sdk";
import { Button, Flex, Heading, HStack, Stack, Text, useToast } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import WorkflowList from "./WorkflowList";
import ActivityTable from "./ActivityTable";
import { useApp } from "../hailer/use-app";

export interface SelectedState {
  workflow: Workflow;
  phase: WorkflowPhase;
}

export default function ActivityView() {
  const { hailer, event, ready, config, app } = useApp();
  const toast = useToast();

  const [activities, setActivities] = useState<Activity[]>([]);

  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow>();
  const [selectedWorkflowPhase, setSelectedWorkflowPhase] = useState<WorkflowPhase>();

  useEffect(() => {
    if (!hailer || !ready) {
      return;
    }

    (async () => {
      const activeWorkflowId = selectedWorkflow?._id || config?.workflowId || undefined;

      const workflow = app.workflows.find(workflow => workflow._id === activeWorkflowId);

      if (workflow) {
        const activeWorkflowPhase = workflow.phases[selectedWorkflowPhase?._id || workflow.phasesOrder[0]];
        setSelectedWorkflow(workflow);
        setSelectedWorkflowPhase(activeWorkflowPhase)
      }
    })();

    const activityChangeHandler = (data: { [key: string]: string | number }) => {
      if (
        data.workflowId === selectedWorkflow?._id ||
        // some update signals only contain phaseId, but we can work around that by checking if it exists in the selected workflow
        !!selectedWorkflow?.phases[data.phaseId]
      ) {
        void list();
      }
    }

    event?.on('activity.create', activityChangeHandler);
    event?.on('activity.update', activityChangeHandler);
    event?.on('activity.remove', activityChangeHandler);

    return () => {
      event?.off('activity.create', activityChangeHandler);
      event?.off('activity.update', activityChangeHandler);
      event?.off('activity.remove', activityChangeHandler);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hailer, ready, selectedWorkflow?._id, selectedWorkflowPhase?._id]);

  useEffect(() => {
    if (selectedWorkflow) {
      const activeWorkflowPhase = selectedWorkflow.phases[selectedWorkflowPhase?._id || selectedWorkflow.phasesOrder[0]];
      setSelectedWorkflowPhase(activeWorkflowPhase)

      void list();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWorkflow, selectedWorkflowPhase?._id]);

  const list = async () => {
    if (!selectedWorkflow?._id || !selectedWorkflowPhase?._id) {
      // prevent listing if workflowId or phaseId is not set
      return;
    }

    try {
      const activities = await hailer?.activity.list(selectedWorkflow._id, selectedWorkflowPhase._id, { includeHistory:false, includeTeams: false, includeUsers: false });

      if (!activities) {
        return;
      }

      setActivities(activities);
      
    } catch (error) {
      const hailerError = error as HailerError;
      toast({ description: hailerError.msg, status: 'error', isClosable: true });
    }
  }

  const remove = async (activityId: string) => {
    try {
      await hailer?.activity.remove([activityId]);
    } catch (error) {
      const hailerError = error as HailerError;
      toast({ description: hailerError.msg, status: 'error', isClosable: true });
    }
  }

  const createActivity = async () => {
    if (!selectedWorkflow?._id) {
      return;
    }

    try {
      await hailer?.activity.create(selectedWorkflow._id, [{
        name: 'Do some cool stuff',
        fields: {},
      }]);
    } catch (error) {
      console.log('Error creating activity:', error as HailerError);
      toast({ description: "Activity create failed. " + (error as HailerError).msg, status: 'error', isClosable: true });
    }
  }

  /**
   * Open Create Activity Card in Hailer
   * 
   * Demonstrates prefilling fields if the fields Ids are set
   */
  const createActivitySidenav = async () => {
    if (!selectedWorkflow?._id) {
      return;
    }

    const created = await hailer?.ui.activity.create(selectedWorkflow._id, { name: 'Aloha!' });

    if (created) {
      toast({ description: "Activity created", status: 'success', isClosable: true });
    } else {
      toast({ description: "Activity creation failed", status: 'error', isClosable: true });
    }
  }

  const updateWorkflow = async (workflow: Workflow) => {
    setSelectedWorkflow(workflow);

    try {
      await hailer?.app.config.update({ workflowId: workflow._id });
    } catch (error) {
      const hailerError = error as HailerError;
      toast({ description: hailerError.msg, status: 'error', isClosable: true, duration: 9000 });
    }
  };

  return <>
    {hailer && 
      <>
        <Heading fontSize="xl" padding="0px 0 12px">Workflows and Activities</Heading>

        <Text fontSize={'sm'} margin={'0 10px 10px 10px'} maxWidth={'40em'}>
          
        </Text>

        <WorkflowList workflows={app.workflows} select={updateWorkflow} />

        {selectedWorkflow &&
          <>
            <HStack my={3}>
              <Text fontWeight='bold'>Selected workflow:</Text>
              <Text>{selectedWorkflow?.name} ({selectedWorkflow?._id})</Text>
            </HStack>

            <Text fontWeight='bold'>Phases:</Text>
            {selectedWorkflow.phasesOrder.map(phaseId =>
              <Button size={'sm'} colorScheme={phaseId === selectedWorkflowPhase?._id ? 'green' : 'gray'} key={phaseId} onClick={() => setSelectedWorkflowPhase(selectedWorkflow.phases[phaseId])}>{selectedWorkflow.phases[phaseId]?.name}</Button>
            )}
          </>
        }

        {selectedWorkflow && selectedWorkflowPhase &&
          <>
            <Heading fontSize="xl" padding="40px 0 12px">Activities</Heading>
            <Stack flexDir='row' my={3}>
              <Button colorScheme="blue" onClick={() => { createActivity() }}>Create example</Button>
              <Button colorScheme="green" onClick={() => { createActivitySidenav() }}>Add custom</Button>
            </Stack>

            <Flex flexDir='column'>
              <ActivityTable activities={activities} selectedState={{ workflow: selectedWorkflow, phase: selectedWorkflowPhase }} open={(activityId: string) => hailer.ui.activity.open(activityId)} remove={remove} listActivities={(...args) => console.log('Table asking to list activities:', args)} />
            </Flex>
          </>
        }
      </>
    }
  </>
}
