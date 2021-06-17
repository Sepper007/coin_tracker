import React from 'react';
import {Route} from 'react-router-dom';

export default function TernaryRoute({trueComponent, falseComponent, value, ...rest}) {
    return <Route
        component={value ? trueComponent : falseComponent}
        {...rest}
    />
}
