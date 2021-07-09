import React from 'react';
import { createPortal } from 'react-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export enum toastTypes {
    info = 'info',
    success = 'success',
    warning = 'warning',
    error = 'error',
    default = 'default',
    dark = 'dark'
}


export const MessageToast = () => {
    return createPortal(
        <ToastContainer
            closeButton={false}
            autoClose={3000}
            hideProgressBar
            closeOnClick
            position={toast.POSITION.BOTTOM_CENTER}
        />,
        document.body
    );
};

MessageToast.create = (type: toastTypes, text: string, options?: object) => {
    // @ts-ignore
    toast[type](text, options);
};
