import { Activity } from "@hailer/app-sdk";
import ActivityField from "./ActivityField";
import { IconButton, Table, TableContainer, Tbody, Td, Th, Thead, Tooltip, Tr, useDisclosure } from "@chakra-ui/react";
import { useState } from "react";
import { HailerInfo } from "../hailer/theme/icons/HailerInfo";
import DeleteAlertDialog from "./DeleteAlertDialog";
import { HailerX } from "../hailer/theme/icons/HailerX";
import { SelectedState } from "./ActivityView";
import { useApp } from "../hailer/use-app";

export default function ActivityTable(props: { selectedState: SelectedState, activities: Activity[], open: (activityId: string) => void, remove: (activityId: string) => void, listActivities: (search?: string, skip?: number, limit?: number) => void }) {
    const { user } = useApp();
    const [deleteActivityId, setDeleteActivityId] = useState<string | null>(null); 
    const { isOpen, onOpen, onClose } = useDisclosure();

    const phaseFields = props.selectedState.phase.fields || [];

    /** Returns phase fields in the correct order set in workflow */
    const fieldIdsInOrder = (): string[] => {
        return props.selectedState.workflow?.fieldsOrder?.filter((fieldId: string) => phaseFields.includes(fieldId)) || [];
    }



    return (
      <>
        <TableContainer>
            <Table variant='striped' size='sm'>
                <Thead>
                    <Tr>
                        <Th>
                            Open
                        </Th>
                        <Th>Name</Th>
                        {  fieldIdsInOrder().map(fieldId => {
                            return <Th key={fieldId}>{props.selectedState.workflow.fields[fieldId].label}</Th>
                        })}
                    </Tr>
                </Thead>
                <Tbody>
                    { props.activities.map(activity => (
                        <Tr key={activity._id}>
                            <Td>
                                <IconButton isRound={true} variant='solid' fontSize='20px' onClick={() => props.open(activity._id)} aria-label="Open activity in sidenav" icon={<HailerInfo />}></IconButton>

                                <Tooltip label="Delete activity" aria-label='Delete activity' hasArrow placement='top'>
                                  <IconButton icon={<HailerX />} size='sm' colorScheme='red' variant='ghost' aria-label='Delete activity' onClick={() => {setDeleteActivityId(activity._id); onOpen()}}/>
                                </Tooltip>


                                <DeleteAlertDialog 
                                  isOpen={isOpen && deleteActivityId === activity._id}
                                  onClose={() => {
                                    onClose();
                                    setDeleteActivityId(null);
                                  }}
                                  onDelete={() => { props.remove(activity._id); onClose() }}
                                  title="Delete Activity?" 
                                  bodyText={`Are you sure you want to delete "${activity.name}"?`}
                                />


                            </Td>
                            <Td data-cy={`${activity._id}-name-field`} key={activity._id + 'name-field'} minW='250px'>
                              {activity.name}
                            </Td>
                            { fieldIdsInOrder().map((fieldId: string) => (
                                <Td key={activity._id + fieldId} maxW='300px' overflow="hidden" textOverflow="ellipsis">
                                    {props.selectedState.workflow.fields[fieldId]?.functionEnabled && <span style={{ color: '#999999' }}>𝑓 </span>}
                                    <span data-cy={`activity-field-${activity._id}-${fieldId}`}>
                                        <ActivityField
                                            type={props.selectedState.workflow.fields[fieldId]?.type}
                                            value={activity.fields?.[fieldId]}
                                            user={{ map: user.map }}
                                        />
                                    </span>
                                </Td>
                            ))}
                        </Tr>
                    ))}
                </Tbody>
            </Table>
        </TableContainer>
    </>
    )
}
