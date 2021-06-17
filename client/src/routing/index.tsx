import React from 'react';
import {Redirect, Route, Router as HashRouter, Switch} from 'react-router-dom';
import {createHashHistory} from 'history';
import SignIn from '../SignIn';
import SignUp from '../SignUp';
import TernaryRoute from "./TernaryRoute";
import Homepage from "../components/HomePage";
import LoadingSpinner from "../components/LoadingSpinner";

export interface Props {
    authenticated: { value: boolean, initialized: boolean }
    setIsLoggedIn: (loggedIn: boolean) => void;
}

export default function Router({setIsLoggedIn, authenticated}: Props) {

    const HISTORY = createHashHistory();

    return <HashRouter history={HISTORY}>
        <Switch>
            {!authenticated.initialized && <Route component={LoadingSpinner}/>}
            <TernaryRoute path='/' exact value={authenticated.value} trueComponent={Homepage}
                          falseComponent={() => <Redirect to={'/login'}/>}
            />
            <TernaryRoute path='/login' exact value={authenticated.value} trueComponent={() => <Redirect to={'/'}/>}
                          falseComponent={(props: any) => <SignIn setIsLoggedIn={setIsLoggedIn}
                                                                        accountActivated={props.location.search && new URLSearchParams(props.location.search).get('accountActivated')
                                                                        }/>}
            />
            <TernaryRoute path='/signUp' exact value={authenticated.value} trueComponent={() => <Redirect to={'/'}/>}
                          falseComponent={SignUp}/>
        </Switch>
    </HashRouter>;
}
