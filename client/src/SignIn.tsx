import React, {useRef, useCallback, useState} from 'react';
import Avatar from '@material-ui/core/Avatar';
import Button from '@material-ui/core/Button';
import CssBaseline from '@material-ui/core/CssBaseline';
import TextField from '@material-ui/core/TextField';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Checkbox from '@material-ui/core/Checkbox';
import Link from '@material-ui/core/Link';
import Grid from '@material-ui/core/Grid';
import Box from '@material-ui/core/Box';
import LockOutlinedIcon from '@material-ui/icons/LockOutlined';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import Container from '@material-ui/core/Container';
import Alert, {AlertStatus} from "./components/Alert";
import {useHistory} from "react-router";
import {useStore} from "./store";
import axios from 'axios';

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
        marginTop: theme.spacing(1),
    },
    submit: {
        margin: theme.spacing(3, 0, 2),
    },
}));

export interface Props {
    accountActivated: undefined | '' | 'success' | 'error' | 'already_activated'
}

export default function SignIn({accountActivated}: Props) {
    const classes = useStyles();

    // @ts-ignore
    const setIsLoggedIn = useStore(state => state.setIsLoggedIn);

    const emailInputRef = useRef(null);
    const passwordInputRef = useRef(null);

    const [loginError, setLoginError] = useState('');

    const history = useHistory();

    const onSignInClicked = useCallback(async () => {
        const payload = {
            // @ts-ignore
            email: emailInputRef.current.value,
            // @ts-ignore
            password: passwordInputRef.current.value
        };

        try {
            await axios.post('/api/login', payload);

            setIsLoggedIn(true);

            setLoginError('');

            history.push('/');
        } catch (e) {
            setLoginError(e.response.data.errorMessage);
        }

    }, []);

    return (
        <Container component="main" maxWidth="xs">
            <CssBaseline />
            {accountActivated &&
            accountActivated === 'already_activated' && <Alert status={AlertStatus.info} content={'Your account has already been activated'}/> ||
                accountActivated === 'success' && <Alert status={AlertStatus.success} content={'Your account was successfully activated'}/> ||
                accountActivated === 'error' && <Alert status={AlertStatus.error} content={'An error ocurred while trying to activate your account'}/>
            }
            {
                loginError && <Alert status={AlertStatus.error} content={`Login failed with the following error message: ${loginError}`} />
            }
            <div className={classes.paper}>
                <Avatar className={classes.avatar}>
                    <LockOutlinedIcon />
                </Avatar>
                <Typography component="h1" variant="h5">
                    Sign in
                </Typography>
                <div className={classes.form}>
                    <TextField
                        variant="outlined"
                        margin="normal"
                        required
                        fullWidth
                        id="email"
                        label="Email Address"
                        name="email"
                        autoComplete="email"
                        autoFocus
                        inputRef={emailInputRef}
                    />
                    <TextField
                        variant="outlined"
                        margin="normal"
                        required
                        fullWidth
                        name="password"
                        label="Password"
                        type="password"
                        id="password"
                        autoComplete="current-password"
                        inputRef={passwordInputRef}
                    />
                    <FormControlLabel
                        control={<Checkbox value="remember" color="primary" />}
                        label="Remember me"
                    />
                    <Button
                        fullWidth
                        variant="contained"
                        color="primary"
                        className={classes.submit}
                        onClick={onSignInClicked}
                    >
                        Sign In
                    </Button>
                    <Grid container>
                        <Grid item xs>
                            <Link href="#" variant="body2">
                                Forgot password?
                            </Link>
                        </Grid>
                        <Grid item>
                            <Link href="/#/signUp" variant="body2">
                                {"Don't have an account? Sign Up"}
                            </Link>
                        </Grid>
                    </Grid>
                </div>
            </div>
            <Box mt={8}>
                <Copyright />
            </Box>
        </Container>
    );
}
