const {v4: uuid} = require('uuid');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const crypto = require('crypto');
const {Pool} = require('pg');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_ACCOUNT,
        pass: process.env.GMAIL_PW
    }
});

const userAuthenticationApi = (app) => {

    const users = [
        {id: '2f24vvg', email: 'test@test.com', password: 'password'}
    ];

// configure passport.js to use the local strategy
    passport.use(new LocalStrategy(
        {usernameField: 'email'},
        (email, password, done) => {
            console.log('Inside local strategy callback')
            // here is where you make a call to the database
            const user = users[0]
            if (email === user.email && password === user.password) {
                return done(null, user)
            }

            return done('User not found or invalid password', false, {message: 'User not found or invalid password'});
        }
    ));

    // tell passport how to serialize the user
    passport.serializeUser((user, done) => {
        console.log('Inside serializeUser callback. User id is save to the session file store here')
        done(null, user.id);
    });

    passport.deserializeUser((id, done) => {
        console.log('Inside deserializeUser callback')
        console.log(`The user id passport saved in the session file store is: ${id}`)
        const user = users[0].id === id ? users[0] : false;
        done(null, user);
    });

    app.use(session({
        genid: (req) => {
            console.log('Inside session middleware genid function')
            console.log(`Request object sessionID from client: ${req.sessionID}`)
            return uuid() // use UUIDs for session IDs
        },
        store: new FileStore(),
        // TODO: Use proper keyboard
        secret: 'keyboard cat',
        resave: false,
        saveUninitialized: true
    }));

    app.use(passport.initialize());
    app.use(passport.session());

    app.post('/api/login', (req, res, next) => {
        passport.authenticate('local', (err, user, info) => {
            if (err || info) {
                res.status(500).send({errorMessage: err || info});
            } else {
                req.login(user, (err) => {
                    if (err) {
                        res.status(500).send({errorMessage: err});
                    } else {
                        res.send('{}');
                    }
                });
            }
        })(req, res, next);
    });

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });

    app.post('/api/sign-up', async (req, res) => {
        const {userEmail, password} = req.body;

        if (!userEmail || !password) {
            res.status(400).send({errorMessage: 'userEmail or password is invalid'});
        } else {
            try {
                await createNewUser(userEmail, password);

                res.status(204).send();
            } catch (e) {
                res.status(500).send(e.message);
            }
        }
    });

    app.get('/api/activate-profile/:uid', async (req, res) => {
        const {uid} = req.params;

        const client = await pool.connect();

        const result = await client.query('SELECT t1.email, t2.activated FROM account_activations t1 inner join users t2 on t1.email = t2.email WHERE t1.uid = $1', [uid]);

        if (!result || !result.rows.length) {
            res.status(400).send({errorMessage: 'The activation id that was provided is not valid'});
        } else {
            const { email, activated } = result.rows[0];

            if (activated) {
                res.status(400).send({errorMessage: 'Your account was already activated'});
            } else {
                await client.query('UPDATE users SET activated = 1 WHERE email = $1', [email]);

                res.status(204).send();
            }
        }
    });


    const createNewUser = async (userEmail, password) => {
        // Creating a unique salt for a particular user
        const salt = crypto.randomBytes(16).toString('hex');

        // Hashing user's salt and password with 1000 iterations,
        const hash = crypto.pbkdf2Sync(password, salt,
            1000, 64, `sha512`).toString(`hex`);

        const client = await pool.connect();

        // Open transaction, and if any step along the way fails, rollback insert stmt
        await client.query('BEGIN');

        try {
            await client.query(`insert into users (email, hash, salt, activated) values ($1, $2, $3, $4)`, [userEmail, hash, salt, 0]);

            const activationUuid = uuid();

            await client.query(`insert into account_activations (email, uid) values ($1, $2)`, [userEmail, activationUuid]);

            const activationUrl = `${process.env.BASE_URL}/api/activate-profile/${activationUuid}`;

            await transporter.sendMail({
                from: process.env.GMAIL_ACCOUNT,
                to: userEmail,
                subject: 'Activate your crypto coin shenanigans account',
                text: `Use the following url to activate your account ${activationUrl}`
            });

            await client.query('COMMIT');
        } catch (e) {
            console.log(`Sign-up process failed with the following error message: ${e.message}, rolling back db transaction`);

            client.query('ROLLBACK');

            throw new Error('sign-up failed');
        } finally {
            client.release();
        }
    }
};

module.exports = userAuthenticationApi;
