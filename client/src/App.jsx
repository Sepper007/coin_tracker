import './App.css';
import React, {useEffect, useState} from 'react';
import Router from "./routing";
import AppHeader from "./components/AppHeader";
import axios from "axios";
import { useStore} from "./store";

function App() {

    const isAuthenticated = useStore(state => state.isLoggedIn);
    const setIsAuthenticated = useStore(state => state.setIsLoggedIn);

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


    return (
        <div className="App">
            { isAuthenticated.value && <AppHeader/>}
            <Router/>
        </div>
    );
}

export default App;
