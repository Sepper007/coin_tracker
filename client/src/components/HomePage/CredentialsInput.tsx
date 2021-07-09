import React, {useCallback, useRef} from "react";
import Typography from "@material-ui/core/Typography";
import TextField from "@material-ui/core/TextField/TextField";
import Button from "@material-ui/core/Button";
import SaveIcon from '@material-ui/icons/Save';
import ReplayIcon from '@material-ui/icons/Replay';
import {createStyles, makeStyles, Theme} from "@material-ui/core";
import {MessageToast, toastTypes} from "../util/MessageToast";
import axios from "axios";

const useStyles = makeStyles((theme: Theme) =>
    createStyles({
        form: {
            maxWidth: '400px',
            margin: '0 auto',
            marginTop: theme.spacing(1),
        },
        credentialsBox: {
            marginTop: theme.spacing(1),
        },
        button: {
            margin: theme.spacing(1),
        },
    }),
);

export interface Props {
    description: string;
    id: string;
}

export default function CredentialsInput ({description, id} : Props) {

    const classes = useStyles();

    const userIdInputRef = useRef<{value: string}>(null);
    const publicKeyInputRef = useRef<{value: string}>(null);
    const privateKeyInputRef = useRef<{value: string}>(null);

    const onDiscardClicked = useCallback(() => {
        // @ts-ignore
        userIdInputRef.current.value = '';
        // @ts-ignore
        publicKeyInputRef.current.value = '';
        // @ts-ignore
        privateKeyInputRef.current.value = '';
    }, []);

    const onSaveClicked = useCallback(async() => {
        if (!userIdInputRef.current?.value || !publicKeyInputRef.current?.value || !privateKeyInputRef.current?.value) {
            MessageToast.create(toastTypes.warning, 'Please fill out all fields required fields!');
        } else {
            try {
                await axios.post(`/api/${id}/tokens`, {
                    userId: userIdInputRef.current.value,
                    publicKey: publicKeyInputRef.current.value,
                    privateKey: privateKeyInputRef.current.value
                });

                MessageToast.create(toastTypes.success, 'Credentials were saved successfully');
            } catch (e) {
                MessageToast.create(toastTypes.error, `The following error occurred while trying to save your credentials: ${e.message}`);
            }
        }
    }, []);

    return <div className={classes.credentialsBox}>
        <Typography component="p">
            You haven't stored your credentials for platform {description} yet.
            If you wish to use this platform, please provide your credentials here:
        </Typography>
        <div className={classes.form}>
            <TextField
                variant="outlined"
                margin="normal"
                required
                fullWidth
                id="userId"
                label="User Id"
                autoFocus
                inputRef={userIdInputRef}
            />
            <TextField
                variant="outlined"
                margin="normal"
                required
                fullWidth
                id="publicKey"
                label="Public key"
                autoFocus
                inputRef={publicKeyInputRef}
            />
            <TextField
                variant="outlined"
                margin="normal"
                required
                fullWidth
                name="privateKey"
                label="Private Key"
                type="password"
                id="privateKey"
                inputRef={privateKeyInputRef}
            />
        </div>
        <div>
            <Button
                variant="contained"
                color="primary"
                className={classes.button}
                startIcon={<SaveIcon />}
                onClick={onSaveClicked}
            >
                Save
            </Button>
            <Button
                type="submit"
                variant="contained"
                startIcon={<ReplayIcon />}
                onClick={onDiscardClicked}
            >
                Discard
            </Button>

        </div>
    </div>;
}
