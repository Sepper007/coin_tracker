const {v4: uuid} = require('uuid');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

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

// create the homepage route at '/'
    app.get('/', (req, res) => {
        console.log('Inside the homepage callback')
        console.log(req.sessionID)
        res.send(`You got home page!\n`)
    });

// create the login get and post routes
    app.get('/login', (req, res) => {
        console.log('Inside GET /login callback')
        console.log(req.sessionID)
        res.send(`You got the login page!\n`)
    });

    app.post('/login', (req, res, next) => {
        passport.authenticate('local', (err, user, info) => {
            if (err || info) {
                res.status(500).send({ errorMessage : err || info});
            } else {
                req.login(user, (err) => {
                    if (err) {
                        res.status(500).send({ errorMessage : err});
                    } else {
                        res.send('{}');
                    }
                });
            }
        })(req, res, next);
    });
};

module.exports = userAuthenticationApi;
