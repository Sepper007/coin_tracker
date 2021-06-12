import {CircularProgress, makeStyles} from "@material-ui/core/index";
import React from "react";


const useStyles = makeStyles((theme) => ({
    spinnerBox: {
        position: 'absolute',
        width: '100%',
        height: '100%'
    },
    spinner: {
        top: 'calc(50% - 20px)',
        left: 'calc(50% - 20px)'
    }
}));

export default function LoadingSpinner() {

    const classes = useStyles();

    return <div className={classes.spinnerBox}>
            <CircularProgress className={classes.spinner}/>
    </div>;
}
