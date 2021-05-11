const express = require('express');
const app = express();

const port = process.env.PORT || 3000;

app.use(express.json());

app.use(express.static('public'));

const coinTracker = require('./coinTracker');

app.post('/startTracking/coin/:coinId/user/:userId/amount/:amount', (req, res) => {
    const { coinId, userId, amount } = req.params;

    coinTracker.start(coinId, userId, amount);

    res.send('{}', 204);
});

app.post('/stopTracking/coin/:coinId/user/:userId', (req, res) => {
    const { coinId, userId } = req.params;

    coinTracker.stop(coinId, userId);

    res.send('{}', 204);
});

app.get('/trackingStatus/:userId/id/:coinId', (req, res) => {
    const { userId, coinId } = req.params;

    res.send(coinTracker.status(userId, coinId));
});

app.get('/trackingStatus', (req, res) => {
    res.send(coinTracker.status());
});

app.get('/meta/:coinId', async (req, res) => {
    const { coinId } = req.params;

    try {
        res.send(await coinTracker.getCoinMetadata(coinId));
    } catch (e) {
        res.send(e.message, 500);
    }

});

app.get('/meta', async (req, res) => {
    try {
        res.send(await coinTracker.getCoinMetadata());
    } catch (e) {
        res.send(e.message, 500);
    }
});


app.get('/currentTicker/:coinId', async (req, res) => {
    const { coinId } = req.params;

    res.send(await coinTracker.fetchTicker(coinId));
});

app.get('/history/:coinId', async(req, res) => {
    const { coinId } = req.params;

    try {
        res.send(await coinTracker.getTickerHistory(coinId));
    } catch (e) {
        res.send(e.message, 500);
    }
});

app.get('/trades/:coinId', async(req, res) => {
    const { coinId } = req.params;

    try {
        res.send(await coinTracker.getRecentTrades(coinId));
    } catch (e) {
        res.send(e.message, 500);
    }
});

app.post('/add-user-info', async(req, res) => {
    try {
        await coinTracker.login(req.body);

        res.send({}, 204);
    } catch (e) {
        res.send(e.message, 500);
    }
});

app.post('/cancelAllOrders/:userId', async(req, res) => {
   try {
       const { userId } = req.params;

       await coinTracker.cancelAllOrders(userId);

       res.send({}, 204);
   } catch (e) {
       res.send(e.message, 500);
   }
});

app.post('/order/:userId', async(req, res) => {
    try {
        const { userId } = req.params;

        const { coinId, price, amount, action ='sell', type = 'limit' } = req.body;

        const resp = await coinTracker.createOrder(userId, coinId, price, amount, action, type);

        res.send(resp);
    } catch (e) {
        res.send(e.message, 500);
    }
});

app.get('/order/:userId/id/:orderId', async(req, res) => {
    try {
        const { userId, orderId } = req.params;

        const resp = await coinTracker.fetchOrder(userId, orderId);

        res.send(resp);
    } catch (e) {
        res.send(e.message, 500);
    }
});

app.get('/trades/user/:userId/coin/:coinId', async(req, res) => {
    try {
        const { userId, coinId } = req.params;

        const resp = await coinTracker.fetchMyTrades(userId, coinId);

        res.send(resp);
    } catch (e) {
        res.send(e.message, 500);
    }
});

app.get('/trades/user/:userId/coin/:coinId/hours/:hours', async(req, res) => {
    try {
        const { userId, coinId, hours } = req.params;

        const resp = await coinTracker.fetchMyTrades(userId, coinId, hours);

        res.send(resp);
    } catch (e) {
        res.send(e.message, 500);
    }
});

app.get('/trades/user/:userId/coin/:coinId/since-tracking-start', async(req, res) => {
    try {
        const { userId, coinId } = req.params;

        const resp = await coinTracker.fetchMyTrades(userId, coinId, null, true);

        res.send(resp);
    } catch (e) {
        res.send(e.message, 500);
    }
});



app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
});
