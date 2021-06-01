const express = require('express');
const path = require('path');
const {Pool} = require('pg');
const auth = require('./auth');

const userAuthenticationApi = require('./api/userAuthenticationApi');

const app = express();

const port = process.env.PORT || 3000;

app.use(express.json());

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'client/build')));

userAuthenticationApi(app);

// Load different platforms
const NDaxTradingPlatform = require('./platforms/NDAXTradingPlatform');

const tradingPlatforms = {
    ndax: new NDaxTradingPlatform()
};


// Load different modules
const coinTracker = require('./coinTracker');

const tradingAnalytics = require('./modules/tradingAnalytics');

const TradingBotsTracker = require('./modules/bots/TradingBotsTracker');

const tradingBotsTracker = new TradingBotsTracker();

app.post('/startMarketSpreadBot/coin/:coinId/user/:userId/amount/:amount', (req, res) => {
    const {coinId, userId, amount} = req.params;

    // TODO: Once several platforms are supported, add these params to request body or url
    const platformName = 'ndax';
    const platformInstance = tradingPlatforms.ndax;

    tradingBotsTracker.startBotForUser(userId, TradingBotsTracker.botTypes.marketSpread, platformName, coinId, amount, platformInstance);

    res.send('{}', 204);
});

app.post('/stopMarketSpreadBot/coin/:coinId/user/:userId', (req, res) => {
    const {coinId, userId} = req.params;

    const soft = req.query.soft || false;

    // TODO: Once several platforms are supported, add these params to request body or url
    const platformName = 'ndax';

    tradingBotsTracker.stopBotForUser(userId, TradingBotsTracker.botTypes.marketSpread, platformName, coinId, soft);

    res.send('{}', 204);
});

app.get('/trackingStatus/:userId/id/:coinId', (req, res) => {
    const {userId, coinId} = req.params;

    res.send(coinTracker.status(userId, coinId));
});

app.get('/trackingStatus', (req, res) => {
    res.send(coinTracker.status());
});

app.get('/meta/:coinId', async (req, res) => {
    const {coinId} = req.params;

    try {
        res.send(await tradingPlatforms.ndax.getCoinMetadata(coinId));
    } catch (e) {
        res.send(e.message, 500);
    }

});

app.get('/meta', auth.required, async (req, res) => {
    try {
        res.send(await tradingPlatforms.ndax.getCoinMetadata());
    } catch (e) {
        res.send(e.message, 500);
    }
});


app.get('/currentTicker/:coinId', async (req, res) => {
    const {coinId} = req.params;

    res.send(await tradingPlatforms.ndax.fetchTicker(coinId));
});

app.get('/history/:coinId', async (req, res) => {
    const {coinId} = req.params;

    try {
        res.send(await tradingPlatforms.ndax.getTickerHistory(coinId));
    } catch (e) {
        res.send(e.message, 500);
    }
});

app.get('/trades/:coinId', async (req, res) => {
    const {coinId} = req.params;

    try {
        res.send(await tradingPlatforms.ndax.getRecentTrades(coinId));
    } catch (e) {
        res.send(e.message, 500);
    }
});

app.post('/add-user-info', async (req, res) => {
    try {
        await tradingPlatforms.ndax.login(req.body);

        res.send({}, 204);
    } catch (e) {
        res.send(e.message, 500);
    }
});

app.post('/cancelAllOrders/:userId', async (req, res) => {
    try {
        const {userId} = req.params;

        await tradingPlatforms.ndax.cancelAllOrders(userId);

        res.send({}, 204);
    } catch (e) {
        res.send(e.message, 500);
    }
});

app.post('/order/:userId', async (req, res) => {
    try {
        const {userId} = req.params;

        const {coinId, price, amount, action = 'sell', type = 'limit'} = req.body;

        const resp = await tradingPlatforms.ndax.createOrder(userId, coinId, price, amount, action, type);

        res.send(resp);
    } catch (e) {
        res.send(e.message, 500);
    }
});

app.get('/order/:userId/id/:orderId', async (req, res) => {
    try {
        const {userId, orderId} = req.params;

        const resp = await tradingPlatforms.ndax.fetchOrder(userId, orderId);

        res.send(resp);
    } catch (e) {
        res.send(e.message, 500);
    }
});

app.get('/trades/user/:userId/coin/:coinId', async (req, res) => {
    try {
        const {userId, coinId} = req.params;

        const resp = await tradingPlatforms.ndax.getMyTrades(coinId, userId);

        res.send(resp);
    } catch (e) {
        res.send(e.message, 500);
    }
});

app.get('/trades/user/:userId/coin/:coinId/hours/:hours', async (req, res) => {
    try {
        const {userId, coinId, hours} = req.params;

        const {trades, ticker, minutesUp} = await tradingPlatforms.ndax.getMyTrades(coinId, userId, hours);

        const aggregatedTrades = tradingAnalytics.aggregateMyTrades(coinId, minutesUp, trades, ticker);

        res.send(aggregatedTrades);
    } catch (e) {
        res.send(e.message, 500);
    }
});

app.get('/trades/user/:userId/coin/:coinId/since-tracking-start', async (req, res) => {
    try {
        const {userId, coinId} = req.params;

        const resp = await tradingPlatforms.ndax.getMyTrades(coinId, userId, null, true);

        res.send(resp);
    } catch (e) {
        res.send(e.message, 500);
    }
});

app.get('/test/db', async (req, res) => {
    try {
        const {Pool} = require('pg');
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false
            }
        });

        const client = await pool.connect();
        const result = await client.query('SELECT * FROM test_table');
        const results = {'results': (result) ? result.rows : null};
        client.release();

        res.send(results);
    } catch (err) {
        console.error(err);
        res.send("Error " + err);
    }
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname+'/client/public/index.html'));
});


app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
});
