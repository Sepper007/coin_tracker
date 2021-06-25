import React from 'react';
import {Route} from 'react-router-dom';
import {Redirect} from "react-router";
import { useStore} from "../store";

export default function ProtectedRoute({children, ...rest}) {
    const isLoggedIn = useStore(state => state.isLoggedIn.value);

    return <Route
        {...rest}
        render={({location}) =>
            isLoggedIn ? (
                children
            ) : (
                <Redirect
                    to={{
                        pathname: "/login",
                        state: {from: location}
                    }}
                />
            )
        }
    />;
}
