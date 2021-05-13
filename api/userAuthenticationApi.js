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
                console.log('Local strategy returned true')
                return done(null, user)
            }

            return done('User not found', false, {message: 'User not found'});
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
        console.log('Inside POST /login callback')
        passport.authenticate('local', (err, user, info) => {
            console.log('Inside passport.authenticate() callback');
            console.log(`req.session.passport: ${JSON.stringify(req.session.passport)}`)
            console.log(`req.user: ${JSON.stringify(req.user)}`)
            req.login(user, (err) => {
                console.log('Inside req.login() callback')
                console.log(`req.session.passport: ${JSON.stringify(req.session.passport)}`)
                console.log(`req.user: ${JSON.stringify(req.user)}`)
                return res.send('You were authenticated & logged in!\n');
            })
        })(req, res, next);
    });
};

module.exports = userAuthenticationApi;
