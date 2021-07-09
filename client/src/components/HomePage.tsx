import React, {useCallback, useEffect, useState} from 'react';
import {createStyles, List, ListItem, ListItemText, MenuItem, Theme} from "@material-ui/core";
import Select from "@material-ui/core/Select";
import InputLabel from "@material-ui/core/InputLabel";
import Button from "@material-ui/core/Button";
import ExitToAppIcon from '@material-ui/icons/ExitToApp';
import FormControl from "@material-ui/core/FormControl";
import {makeStyles} from '@material-ui/core/styles';
import axios from 'axios';
import Grid from "@material-ui/core/Grid";
import Paper from "@material-ui/core/Paper/Paper";
import CredentialsInput from "./HomePage/CredentialsInput";
import {MessageToast, toastTypes} from "./util/MessageToast";


const useStyles = makeStyles((theme: Theme) =>
    createStyles({
        formControl: {
            margin: 10,
            minWidth: 120,
        },
        selectEmpty: {
            marginTop: 1,
        },
        root: {
            flexGrow: 1,
        },
        paper: {
            textAlign: 'center',
            color: theme.palette.text.secondary,
        },
        button: {
            margin: theme.spacing(1),
        },
        floatRight: {
            float: 'right'
        }
    }),
);

interface Platform {
    active: boolean,
    id: string,
    description: string,
    userCredentialsAvailable: boolean,
    platformUserId?: number
}

export default function Homepage() {
    const classes = useStyles();

    const [platforms, setPlatforms] = useState<Platform[]>([]);

    const [selectedPlatform, setSelectedPlatform] = useState<Platform | undefined>(undefined);

    const [platformMeta, setPlatformMeta] = useState<any>({});

    const onPlatformSelectionChange = useCallback((evt) => {
        setSelectedPlatform(platforms.find(platform => platform.id === evt.target.value));
    }, [setSelectedPlatform, platforms]);

    useEffect(() => {
        const fn = async () => {
            if (selectedPlatform) {
                const {data} = await axios.get(`/api/${selectedPlatform.id}/meta`);

                setPlatformMeta(data);

                if (selectedPlatform.userCredentialsAvailable) {
                    await axios.get(`api/${selectedPlatform.id}/trades/coin/doge/hours/12151`);
                }
            }
        };

        fn();
    }, [selectedPlatform, setPlatformMeta]);

    useEffect(() => {
        const fn = async () => {
            try {
                const {data} = await axios.get('/api/platform');

                setPlatforms(data);
            } catch (e) {
                console.log(`An error occurred while fetching the available platforms: ${e.message}`);
            }
        };

        fn();
    }, []);

    const onCredentialsDeleteClicked = useCallback(async () => {
        try {
            await axios.delete(`/api/${selectedPlatform?.id}/tokens`);

            MessageToast.create(toastTypes.success, 'Credentials were deleted successfully');
        } catch (e) {
            MessageToast.create(toastTypes.error, `The following error occurred while trying to delete your credentials: ${e.message}`);
        }
    }, [selectedPlatform]);

    return <div>
        <FormControl variant={'outlined'} className={classes.formControl}>
            <InputLabel id="demo-simple-select-outlined-label">Platform</InputLabel>
            <Select
                labelId="demo-simple-select-outlined-label"
                id="demo-simple-select-outlined"
                onChange={onPlatformSelectionChange}
                label="Platform"
            >
                {!platforms.length && <MenuItem value={''}/>}
                {
                    platforms
                        .filter(platform => platform.active)
                        .map(platform => <MenuItem value={platform.id}>{platform.description}</MenuItem>)
                }
            </Select>
        </FormControl>
        <div className={classes.root}>
            {selectedPlatform && selectedPlatform.userCredentialsAvailable && <>
                <div className={classes.floatRight}>
                    <span>Logged into platform with user id {selectedPlatform.platformUserId}</span>
                    <Button
                        variant="contained"
                        color="secondary"
                        className={classes.button}
                        startIcon={<ExitToAppIcon />}
                        size="small"
                        onClick={onCredentialsDeleteClicked}
                    >
                        Logout
                    </Button>
                </div>
                <Grid container spacing={3}>
                    <Grid item xs={6}>
                        <Paper className={classes.paper}>
                            {
                                selectedPlatform && selectedPlatform.userCredentialsAvailable && <>
                                    <h3>Supported Trading Pairs</h3>
                                    <List>
                                        {
                                            platformMeta.supportedCoins && Object.values(platformMeta.supportedCoins).map(coin => (
                                                <ListItem>
                                                    <ListItemText>{
                                                        // @ts-ignore
                                                        coin.marketId
                                                    }
                                                    </ListItemText>
                                                </ListItem>))
                                        }
                                    </List>
                                </>
                            }
                        </Paper>
                    </Grid>
                    <Grid item xs={6}>
                        <Paper className={classes.paper}>xs=6</Paper>
                    </Grid>
                </Grid>
            </>
            }
            {
                selectedPlatform && !selectedPlatform.userCredentialsAvailable &&
                <CredentialsInput description={selectedPlatform.description} id={selectedPlatform.id}/>
            }
        </div>
    </div>;
}
