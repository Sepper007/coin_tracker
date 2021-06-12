import {Alert as MaterialUiAlert} from "@material-ui/lab";
import React, {ReactNode} from "react";

export type AlertStates =  'success' | 'info' | 'warning' | 'error';

export const AlertStatus: {[key: string]: AlertStates} = {
    error: 'error',
    success: 'success',
    info: 'info',
    warning: 'warning'
};

interface Props {
    onClose?: () => void;
    status: 'success' | 'info' | 'warning' | 'error';
    content: string | ReactNode;
}

export default function Alert({status, content, onClose} : Props) {
    return <div>
        <MaterialUiAlert onClose={onClose} color={status}>{content}</MaterialUiAlert>
    </div>
}
