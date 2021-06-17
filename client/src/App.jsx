import './App.css';
import React, {useEffect, useState} from 'react';
import Router from "./routing";
import AppHeader from "./components/AppHeader";
import axios from "axios";

function App() {

    const [isAuthenticated, setIsAuthenticated] = useState({
        initialized: false,
        value: false
    });

    useEffect(() => {
        async function fetchInfo() {
            try {
                const {data} = await axios.get('/api/logged-in');
                setIsAuthenticated({
                    initialized: true,
                    value: data.authenticated
                });
            } catch (e) {
                console.log(`An error occurred while fetching the information whether user is logged in: ${e.message}`);
                setIsAuthenticated({
                    initialized: true,
                    value: false
                });
            }
        }

        fetchInfo();
    }, []);


    return (
        <div className="App">
            { isAuthenticated.value && <AppHeader onLogout={() => setIsAuthenticated((state) => ({...state, value: false}))}/>}
            <Router authenticated={isAuthenticated} setIsLoggedIn={(loggedIn) => setIsAuthenticated((state) => ({...state, value: loggedIn}))}/>
        </div>
    );
}

export default App;
