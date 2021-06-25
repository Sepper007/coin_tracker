import React, {useCallback, useEffect, useState} from 'react';
import {Route, Router as HashRouter, Switch} from 'react-router-dom';
import {createHashHistory} from 'history';
import SignIn from '../SignIn';
import SignUp from '../SignUp';
import ProtectedRoute from "./ProtectedRoute";
import Homepage from "../components/HomePage";
import LoadingSpinner from "../components/LoadingSpinner";
import { useStore} from "../store";
import UnAuthorizedOnlyRoute from "./UnAuthorizedOnlyRoute";

export default function Router() {

    const HISTORY = createHashHistory();

    // @ts-ignore
    const authenticated = useStore(state => state.isLoggedIn);

    return <HashRouter history={HISTORY}>
        <Switch>
            {!authenticated.initialized && <Route component={LoadingSpinner}/>}
            <ProtectedRoute path='/' exact>
                <Homepage />
            </ProtectedRoute>
            <UnAuthorizedOnlyRoute path='/login' exact component={(location: any) => <SignIn accountActivated={location.search && new URLSearchParams(location.search).get('accountActivated')}/>}/>
            <UnAuthorizedOnlyRoute path='/signUp' exact>
                <SignUp/>
            </UnAuthorizedOnlyRoute>
        </Switch>
    </HashRouter>;
}
