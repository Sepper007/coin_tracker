import React from 'react';
import { Route, Router as HashRouter, Switch } from 'react-router-dom';
import { createHashHistory } from 'history';
import SignIn from '../SignIn';

export default function Router() {

    const HISTORY = createHashHistory();

    return <HashRouter history={HISTORY}>
        <Switch>
            <Route path='/' exact component={() => <div>coming soon</div>} />
            <Route path='/login' exact component={SignIn}/>
        </Switch>
    </HashRouter>;
}
