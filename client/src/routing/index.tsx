import React, {useEffect, useState} from 'react';
import {Route, Router as HashRouter, Switch} from 'react-router-dom';
import {createHashHistory} from 'history';
import SignIn from '../SignIn';
import SignUp from '../SignUp';
import axios from "axios";

export default function Router() {

    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        async function fetchInfo() {
            try {
                const {data} = await axios.get('/api/logged-in');
                setIsAuthenticated(data.authenticated);
            } catch (e) {
                console.log(`An error occurred while fetching the information whether user is logged in: ${e.message}`);
                setIsAuthenticated(false);
            }
        }
        fetchInfo();
    }, []);

    const HISTORY = createHashHistory();

    return <HashRouter history={HISTORY}>
        <Switch>
            <Route path='/' exact component={() => <div>coming soon</div>}/>
            <Route path='/login' exact component={(props: any) => <SignIn accountActivated={props.location.search && new URLSearchParams(props.location.search).get('accountActivated')}/>} />
            <Route path='/signUp' exact component={SignUp}/>
        </Switch>
    </HashRouter>;
}
