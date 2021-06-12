import React, {ReactNode, useCallback, useRef, useState} from 'react';
import Avatar from '@material-ui/core/Avatar';
import Button from '@material-ui/core/Button';
import CssBaseline from '@material-ui/core/CssBaseline';
import TextField from '@material-ui/core/TextField';
import Link from '@material-ui/core/Link';
import Grid from '@material-ui/core/Grid';
import Box from '@material-ui/core/Box';
import LockOutlinedIcon from '@material-ui/icons/LockOutlined';
import Typography from '@material-ui/core/Typography';
import {makeStyles} from '@material-ui/core/styles';
import Container from '@material-ui/core/Container';
import axios from "axios";
import LoadingSpinner from "./components/LoadingSpinner";
import Alert, {AlertStatus, AlertStates} from "./components/Alert";

function Copyright() {
    return (
        <Typography variant="body2" color="textSecondary" align="center">
            {'Copyright © '}
            <Link color="inherit" href="/">
                Crypto Coin Shenanigans
            </Link>{' '}
            {new Date().getFullYear()}
            {'.'}
        </Typography>
    );
}

const useStyles = makeStyles((theme) => ({
    paper: {
        marginTop: theme.spacing(8),
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
    },
    avatar: {
        margin: theme.spacing(1),
        backgroundColor: theme.palette.secondary.main,
    },
    form: {
        width: '100%', // Fix IE 11 issue.
        marginTop: theme.spacing(3),
    },
    submit: {
        margin: theme.spacing(3, 0, 2),
    },
}));

const defaultAlertState = {
    active: false,
    status: AlertStatus.success,
    content: ''
};

export default function SignUp() {
    const classes = useStyles();

    const emailInputRef = useRef(null);
    const passwordInputRef = useRef(null);

    const [saving, setSaving] = useState(false);

    const [alertState, setAlertState] = useState<{active: boolean, status: AlertStates, content: string | ReactNode}> (defaultAlertState);

    const onSignUpClicked = useCallback(async () => {
        const payload = {
            // @ts-ignore
            email: emailInputRef.current.value,
            // @ts-ignore
            password: passwordInputRef.current.value
        };

        try {
            setSaving(true);

            await axios.post('/api/sign-up', payload);

            setAlertState({
                active: true,
                status: AlertStatus.success,
                content: <div>Your sign-up was successful. Click on the link in your confirmation e-mail to complete your account creation. <Link href='#login'>Click here to get to the login page</Link></div>
            });
        } catch (e) {
            setAlertState({
                active: true,
                status: AlertStatus.error,
                content: 'An error occurred while creating your account, please try again later.'
            });

            console.log(e);
        } finally {
            setSaving(false);
        }

    }, []);

    return (
        <>
            {alertState.active && <Alert onClose={() => {setAlertState(defaultAlertState)}}
                                         content={alertState.content}
                                         status={alertState.status}
            />}
            <Container component="main" maxWidth="xs">
                <CssBaseline/>
                <div className={classes.paper}>
                    <Avatar className={classes.avatar}>
                        <LockOutlinedIcon/>
                    </Avatar>
                    <Typography component="h1" variant="h5">
                        Sign up
                    </Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            <TextField
                                variant="outlined"
                                required
                                fullWidth
                                id="email"
                                label="Email Address"
                                name="email"
                                autoComplete="email"
                                inputRef={emailInputRef}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                variant="outlined"
                                required
                                fullWidth
                                name="password"
                                label="Password"
                                type="password"
                                id="password"
                                autoComplete="current-password"
                                inputRef={passwordInputRef}
                            />
                        </Grid>
                    </Grid>
                    <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        color="primary"
                        className={classes.submit}
                        onClick={onSignUpClicked}
                    >
                        Sign Up
                    </Button>
                    <Grid container justify="flex-end">
                        <Grid item>
                            <Link href="#login" variant="body2">
                                Already have an account? Sign in
                            </Link>
                        </Grid>
                    </Grid>
                </div>
                <Box mt={5}>
                    <Copyright/>
                </Box>
            </Container>
            {saving && <LoadingSpinner/>}
        </>
    );
}
