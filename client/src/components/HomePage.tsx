import React, {useEffect, useState} from 'react';
import GridLayout from "./GridLayout";
import {createStyles, MenuItem} from "@material-ui/core";
import Select from "@material-ui/core/Select";
import InputLabel from "@material-ui/core/InputLabel";
import FormControl from "@material-ui/core/FormControl";
import {makeStyles} from '@material-ui/core/styles';
import axios from 'axios';

const useStyles = makeStyles(() =>
    createStyles({
        formControl: {
            margin: 10,
            minWidth: 120,
        },
        selectEmpty: {
            marginTop: 1,
        }
    }),
);

interface Platform {
    active: boolean,
    id: string,
    description: string
}

export default function Homepage() {
    const classes = useStyles();


    console.log('Home Page')
    const [platforms, setPlatforms] = useState<Platform[]>([]);

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

    return <div>
        <FormControl variant={'outlined'} className={classes.formControl}>
            <InputLabel id="demo-simple-select-outlined-label">Platform</InputLabel>
            <Select
                labelId="demo-simple-select-outlined-label"
                id="demo-simple-select-outlined"

                label="Platform"
            >
                 {!platforms.length && <MenuItem value={''} />}
                {
                    platforms
                        .filter(platform => platform.active)
                        .map(platform => <MenuItem value={platform.id}>{platform.description}</MenuItem>)
                }
            </Select>
        </FormControl>
        <GridLayout/>
    </div>;
};
