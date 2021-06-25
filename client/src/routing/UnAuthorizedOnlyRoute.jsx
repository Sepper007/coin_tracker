import React from 'react';
import {Route} from 'react-router-dom';
import {Redirect} from "react-router";
import { useStore} from "../store";

export default function UnAuthorizedOnlyRoute({children = null, component = null, ...rest}) {
    const isLoggedIn = useStore(state => state.isLoggedIn.value);

    return <Route
        {...rest}
        render={({location}) =>
            !isLoggedIn ? (
                component ? component(location) : children
            ) : (
                <Redirect
                    to={{
                        pathname: "/",
                        state: {from: location}
                    }}
                />
            )
        }
    />;
}
