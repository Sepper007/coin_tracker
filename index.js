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

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

userAuthenticationApi(app, pool);

// Load different platforms
const NDaxTradingPlatform = require('./platforms/NDAXTradingPlatform');
const BinanceTradingPlaform = require('./platforms/BinanceTradingPlatform');

const tradingPlatforms = {
    ndax: new NDaxTradingPlatform(),
    binance: new BinanceTradingPlaform()
};

const getTradingPlatform = (req) => {
    const { platform } = req.params;

    const instance = tradingPlatforms[platform];

    if (!platform || !instance) {
        throw new Error(`Platform ${platform} is not supported, the supported values are: ${Object.keys(tradingPlatforms).join(',')}`);
    }

    return instance;
};


// Load different modules
const coinTracker = require('./coinTracker');

const tradingAnalytics = require('./modules/tradingAnalytics');

const TradingBotsTracker = require('./modules/bots/TradingBotsTracker');

const tradingBotsTracker = new TradingBotsTracker();

app.post('/api/:platform/startMarketSpreadBot/coin/:coinId/user/:userId/amount/:amount', (req, res) => {
    const {coinId, userId, amount, platform} = req.params;

    const platformInstance = getTradingPlatform(req);

    tradingBotsTracker.startBotForUser(userId, TradingBotsTracker.botTypes.marketSpread, platform, coinId, amount, platformInstance);

    res.send('{}', 204);
});

app.post('/api/:platform/stopMarketSpreadBot/coin/:coinId/user/:userId', (req, res) => {
    const {coinId, userId, platform} = req.params;

    const soft = req.query.soft || false;

    tradingBotsTracker.stopBotForUser(userId, TradingBotsTracker.botTypes.marketSpread, platform, coinId, soft);

    res.send('{}', 204);
});

app.get('/api/:platform/trackingStatus/:userId/id/:coinId', (req, res) => {
    const {userId, coinId} = req.params;

    res.send(coinTracker.status(userId, coinId));
});

app.get('/api/trackingStatus', (req, res) => {
    res.send(coinTracker.status());
});

app.get('/api/:platform/meta/:coinId', async (req, res) => {
    const {coinId} = req.params;

    const platformInstance = getTradingPlatform(req);

    try {
        res.send(await platformInstance.getCoinMetadata(coinId));
    } catch (e) {
        res.send(e.message, 500);
    }

});

app.get('/api/:platform/meta', async (req, res) => {
    try {
        const platformInstance = getTradingPlatform(req);

        res.send(await platformInstance.getCoinMetadata());
    } catch (e) {
        res.send(e.message, 500);
    }
});


app.get('/api/:platform/meta/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const platformInstance = getTradingPlatform(req);

        res.send(await platformInstance.getCoinMetadata(userId));
    } catch (e) {
        res.send(e.message, 500);
    }
});


app.get('/api/:platform/currentTicker/:coinId', async (req, res) => {
    const {coinId} = req.params;

    const platformInstance = getTradingPlatform(req);

    res.send(await platformInstance.fetchTicker(coinId));
});

app.get('/api/:platform/history/:coinId', async (req, res) => {
    const {coinId} = req.params;

    const platformInstance = getTradingPlatform(req);

    try {
        res.send(await platformInstance.getTickerHistory(coinId));
    } catch (e) {
        res.send(e.message, 500);
    }
});

app.get('/api/:platform/trades/:coinId', async (req, res) => {
    const {coinId} = req.params;

    const platformInstance = getTradingPlatform(req);

    try {
        res.send(await platformInstance.getRecentTrades(coinId));
    } catch (e) {
        res.send(e.message, 500);
    }
});

app.post('/api/:platform/add-user-info', async (req, res) => {
    try {
        const platformInstance = getTradingPlatform(req);

        await platformInstance.login(req.body);

        res.send({}, 204);
    } catch (e) {
        res.send(e.message, 500);
    }
});

app.post('/api/:platform/cancelAllOrders/:userId', async (req, res) => {
    try {
        const {userId} = req.params;

        const platformInstance = getTradingPlatform(req);

        await platformInstance.cancelAllOrders(userId);

        res.send({}, 204);
    } catch (e) {
        res.send(e.message, 500);
    }
});

app.post('/api/:platform/order/:userId', async (req, res) => {
    try {
        const {userId} = req.params;

        const platformInstance = getTradingPlatform(req);

        const {coinId, price, amount, action = 'sell', type = 'limit'} = req.body;

        const resp = await platformInstance.createOrder(userId, coinId, price, amount, action, type);

        res.send(resp);
    } catch (e) {
        res.send(e.message, 500);
    }
});

app.get('/api/:platform/order/:userId/id/:orderId/coin/:coinId', async (req, res) => {
    try {
        const {userId, orderId, coinId} = req.params;

        const platformInstance = getTradingPlatform(req);

        const resp = await platformInstance.fetchOrder(userId, orderId, coinId);

        res.send(resp);
    } catch (e) {
        res.send(e.message, 500);
    }
});

app.get('/api/:platform/trades/user/:userId/coin/:coinId', async (req, res) => {
    try {
        const {userId, coinId} = req.params;

        const platformInstance = getTradingPlatform(req);

        const resp = await platformInstance.getMyTrades(coinId, userId);

        res.send(resp);
    } catch (e) {
        res.send(e.message, 500);
    }
});

app.get('/api/:platform/trades/user/:userId/coin/:coinId/hours/:hours', async (req, res) => {
    try {
        const {userId, coinId, hours} = req.params;

        const platformInstance = getTradingPlatform(req);

        const {trades, ticker, minutesUp, marketId} = await platformInstance.getMyTrades(coinId, userId, hours);

        const aggregatedTrades = tradingAnalytics.aggregateMyTrades(coinId, marketId, minutesUp, trades, ticker);

        res.send(aggregatedTrades);
    } catch (e) {
        res.send(e.message, 500);
    }
});

app.get('/api/:platform/trades/user/:userId/coin/:coinId/since-tracking-start', async (req, res) => {
    try {
        const {userId, coinId} = req.params;

        const platformInstance = getTradingPlatform(req);

        const resp = await platformInstance.ndax.getMyTrades(coinId, userId, null, true);

        res.send(resp);
    } catch (e) {
        res.send(e.message, 500);
    }
});

app.post('/api/platform', async (req, res) => {
    try {
        const { name, id } = req.body;

        if (!name || !id) {
            res.status(400).send('Id and name are required paramters');
        } else {
            const client = await pool.connect();

            await client.query('Insert into platforms set id = $1, description = $2', [id, name]);

            res.status(204).send();
        }
    } catch (e) {
        res.send(e.message, 500);
    }
});


app.post('/api/platform/:id/active/:active', async (req, res) => {
    try {
        const { id, active } = req.param;

        await client.query('Update platforms set active = $1 where id = $2', [active, id]);

        res.status(204).send();
    } catch (e) {
        res.send(e.message, 500);
    }
});

app.get('/api/platform', async (req, res) => {
   try {
       const client = await pool.connect();

       const result = await client.query('SELECT * FROM platforms');

       const mappedResp = result.rows.map(row => ({
           id: row.id,
           description: row.description,
           active: !!row.currently_active
       }));

       res.send(mappedResp);
   } catch (e) {
       res.send(e.message, 500);
   }
});

app.get('/api/test/db', async (req, res) => {
    try {
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
