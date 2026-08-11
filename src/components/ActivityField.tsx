import { ActivityFieldValue, WorkflowFieldType } from "@hailer/app-sdk";

export default function ActivityField(props: { type: WorkflowFieldType, value: ActivityFieldValue | undefined, user: { map: { [userId: string]: { firstname: string; lastname: string } } } }) {

    switch (props.type) {
        case 'activitylink':
            if (typeof props.value !== 'object') {
                return <>-</>
            }

            return <>{props.value.name}</>; // _id contains the activity-link target id
        case 'country':
            return <>{ JSON.stringify(props.value) }</>;
        case 'date':
            if (typeof props.value !== 'number') {
                return <>-</>
            }

            return <>{props.value && new Date(props.value).toISOString().slice(0, 10)}</>;
        case 'daterange':
            return <>{ JSON.stringify(props.value) }</>;
        case 'time':
            return <>{ JSON.stringify(props.value) }</>;
        case 'timerange':
            return <>{ JSON.stringify(props.value) }</>;
        case 'datetime':
            return <>{ JSON.stringify(props.value) }</>;
        case 'datetimerange':
            return <>{ JSON.stringify(props.value) }</>;
        case 'numeric':
        case 'numericunit':
            return <>{ props.value ?? props.value }</>;
        case 'teams':
            return <>{ JSON.stringify(props.value) }</>;
        case 'text':
        case 'textarea':
        case 'textunit':
        case 'textpredefinedoptions':
            return <>{ props.value ?? props.value }</>;
        case 'users': {
            if (typeof props.value !== 'string') {
                return <>-</>
            }
            const userDoc = props.user.map[props.value];

            if (!userDoc) {
                return <>Unknown user {props.value} {typeof props.value}</>
            }

            return <>{ userDoc.firstname + ' ' + userDoc.lastname }</>;
        }
        default:
            return <>{props.type} { props.value?.toString() }</>
    }
    
}
