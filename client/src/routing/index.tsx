import React, {useCallback, useEffect, useState} from 'react';
import {Route, Router as HashRouter, Switch} from 'react-router-dom';
import {createHashHistory} from 'history';
import SignIn from '../SignIn';
import SignUp from '../SignUp';
import ProtectedRoute from "./ProtectedRoute";
import Homepage from "../components/HomePage";
import LoadingSpinner from "../components/LoadingSpinner";
import { useStore} from "../store";

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
            <Route path='/login' exact component={(props: any) => <SignIn accountActivated={props.location.search && new URLSearchParams(props.location.search).get('accountActivated')}/>}/>
            <Route path='/signUp' exact>
                <SignUp/>
            </Route>
        </Switch>
    </HashRouter>;
}
