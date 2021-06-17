const {v4: uuid} = require('uuid');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const crypto = require('crypto');
const {Pool} = require('pg');
const nodemailer = require('nodemailer');
const auth = require('../auth');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_ACCOUNT,
        pass: process.env.GMAIL_PW
    }
});

const userAuthenticationApi = (app, pool) => {

    const createPasswordHash = (password, salt) => {
        return crypto.pbkdf2Sync(password, salt, 1000, 64, `sha512`).toString(`hex`);
    }

// configure passport.js to use the local strategy
    passport.use(new LocalStrategy(
        {usernameField: 'email'},
        async (email, password, done) => {
            // here is where you make a call to the database

            // Check if given user exists in the database
            const client = await pool.connect();

            const result = await client.query('SELECT id, email, hash, salt FROM users where email = $1', [email]);

            if (!result.rows || !result.rows.length) {
                return done('User not found or invalid password', false, {message: 'User not found or invalid password'});
            }

            const {hash, salt, id} = result.rows[0];

            // Apply same hashing logic as in the create user case
            const calculatedHash = createPasswordHash(password, salt);

            if (calculatedHash === hash) {
                const user = {
                    id, email, hash
                };

                return done(null, user);
            }

            // Return same error message as in the user not found case, so it's not exposed whether a given e-mail
            // address has an account with this webpage.
            return done('User not found or invalid password', false, {message: 'User not found or invalid password'});
        }
    ));

    passport.serializeUser((user, done) => {
        done(null, {
            id: user.id
        });
    });

    passport.deserializeUser(async(user, done) => {
        try {
            const client = await pool.connect();

            const result = await client.query('SELECT id, email FROM users where id = $1', [user.id]);

            const {id, email} = result.rows[0];

            done(null, {id, email});
        } catch (e) {
            done(e.message, {id: user.id});
        }
    });

    app.use(session({
        genid: (req) => {
            console.log('Inside session middleware genid function')
            console.log(`Request object sessionID from client: ${req.sessionID}`)
            return uuid() // use UUIDs for session IDs
        },
        store: new FileStore(),
        secret: process.env.SESSION_SIGN_SECRET,
        resave: false,
        saveUninitialized: true
    }));

    app.use(passport.initialize());
    app.use(passport.session());

    app.post('/api/sign-up', async (req, res) => {
        const {email, password} = req.body;

        if (!email || !password) {
            res.status(400).send({errorMessage: 'email or password is invalid'});
        } else {
            try {
                await createNewUser(email, password);

                res.status(204).send();
            } catch (e) {
                res.status(500).send(e.message);
            }
        }
    });

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

    app.post('/api/logout', (req, res) => {
        req.session.destroy(() => {
            res.clearCookie('connect.sid');
            res.redirect('/');
        });
    });

    app.get('/api/logged-in', async (req, res) => {
        return res.status(200).send({authenticated: req.isAuthenticated()});
    });

    app.get('/api/activate-profile/:uid', async (req, res) => {
        try {

            const {uid} = req.params;

            const client = await pool.connect();

            const result = await client.query('SELECT t1.id, t2.activated FROM account_activations t1 inner join users t2 on t1.id = t2.id WHERE t1.uid = $1', [uid]);

            if (!result || !result.rows.length) {
                res.redirect('/#/login?accountActivated=error');
            } else {
                const {id, activated} = result.rows[0];

                if (activated) {
                    res.redirect('/#/login?accountActivated=already_activated');
                } else {
                    await client.query('UPDATE users SET activated = 1 WHERE id = $1', [id]);

                    res.redirect('/#/login?accountActivated=success');
                }
            }
        } catch (e) {
            console.log(`An error occurred while trying to activate an account: ${e.message}`);

            res.redirect('/#/login?accountActivated=error');
        }
    });

    app.post('/api/add-tokens/platform/:platform', auth.required, async (req, res) => {
        const {platform} = req.params;

        const {privateKey, publicKey} = req.body;

        if (!platform || !privateKey || !publicKey) {
            res.status(400).send({errorMessage: 'parameters platform, privateKey and publicKey are mandatory!'});
        }

        req.status(204).send();
    });

    const createNewUser = async (userEmail, password) => {
        // Creating a unique salt for a particular user
        const salt = crypto.randomBytes(16).toString('hex');

        // Hashing user's salt and password with 1000 iterations,
        const hash = createPasswordHash(password, salt);

        const client = await pool.connect();

        // Open transaction, and if any step along the way fails, rollback insert stmt
        await client.query('BEGIN');

        try {
            const newId = (await client.query("select nextval('user_ids') as id")).rows[0].id;

            await client.query("insert into users (id, email, hash, salt, activated) values ($1, $2, $3, $4, $5)", [newId, userEmail, hash, salt, 0]);

            await client.query('insert into roles_user_mapping (role_id, user_id) values ($1, $2)', ['user', newId]);

            const activationUuid = uuid();

            await client.query('insert into account_activations (id, uid) values ($1, $2)', [newId, activationUuid]);

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
