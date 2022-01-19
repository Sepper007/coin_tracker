const express = require('express');
const path = require('path');
const {Pool} = require('pg');
const auth = require('./auth');
const utils = require('./modules/utils');
const savingsPlan = require('./modules/savingsPlan');
const userAuthenticationApi = require('./api/userAuthenticationApi');
const TradingBotActivityLog = require('./modules/bots/TradingBotActivityLog');

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

// start savings plan module on boot-up
const savingsPlanInstance = new savingsPlan(pool);

const tradingBotActivityLog = new TradingBotActivityLog(pool);
tradingBotActivityLog.start();

setTimeout(() => savingsPlanInstance.init(), 10 * 1000);

// Load supported platforms
const tradingPlatforms = require('./utils/supportedTradingPlatforms');

const userPlatformInstanceCache = {};

const getTradingPlatform = (req) => {
    const {platform} = req.params;

    if (!tradingPlatforms[platform]) {
        throw new Error(`Platform ${platform} is not supported, the supported values are: ${Object.keys(tradingPlatforms).join(',')}`);
    }

    const userPlatformInstances = userPlatformInstanceCache[req.user.id];

    if (userPlatformInstances && userPlatformInstances[platform]) {
        return userPlatformInstances[platform];
    }

    const accountCredentials = req.user.accountMappings[platform];

    if (!accountCredentials) {
        throw new Error(`User has no credentials stored for platform ${platform}`);
    }

    const instance = new tradingPlatforms[platform]({
        uid: accountCredentials.userId,
        apiKey: accountCredentials.publicKey,
        secret: accountCredentials.privateKey
    });

    userPlatformInstanceCache[req.user.id] = {
        ...userPlatformInstanceCache[req.user.id],
        [platform]: instance
    };

    return instance;
};

// Load different modules

const tradingAnalytics = require('./modules/tradingAnalytics');
const arbitrageOpportunity = require('./modules/arbitrageOpportunity');

const TradingBotsTracker = require('./modules/bots/TradingBotsTracker');

const tradingBotsTracker = new TradingBotsTracker();

app.post('/api/:platform/startMarketSpreadBot/coin/:coinId/amount/:amount', auth.required, (req, res) => {
    const {coinId, amount, platform} = req.params;

    const {email, id} = req.user;

    const platformInstance = getTradingPlatform(req);

    tradingBotsTracker.startBotForUser(email, id, TradingBotsTracker.botTypes.marketSpread, platform, platformInstance, {
        coinId,
        amount
    });

    res.send('{}', 204);
});

app.post('/api/:platform/stopMarketSpreadBot/coin/:coinId', auth.required, (req, res) => {
    const {coinId, platform} = req.params;

    const {email} = req.user;

    const soft = req.query.soft || false;

    tradingBotsTracker.stopBotForUser(email, TradingBotsTracker.botTypes.marketSpread, platform, {coinId}, soft);

    res.send('{}', 204);
});

app.post('/api/:platform/startGridBot', auth.required, (req, res) => {
    try {
        const {coinId, maximumInvestment, numberOfGrids, percentagePerGrid, startingPrice, strategy} = req.body;

        const {platform} = req.params;

        const {email, id} = req.user;

        if (!coinId) {
            throw new Error('coinId is a required value');
        }

        if (!maximumInvestment) {
            throw new Error('maximumInvestment is a required value');
        }

        const platformInstance = getTradingPlatform(req);

        tradingBotsTracker.startBotForUser(email, id, TradingBotsTracker.botTypes.grid, platform, platformInstance, {
            coinId,
            maximumInvestment,
            numberOfGrids,
            percentagePerGrid,
            startingPrice,
            strategy
        });

        res.send('{}', 204);
    } catch (e) {
        res.status(500).send(JSON.stringify(e, Object.getOwnPropertyNames(e)));
    }
});

app.post('/api/:platform/stopGridBot', auth.required, (req, res) => {
    try {
        const {coinId} = req.body;

        const {platform} = req.params;

        const {email} = req.user;

        if (!coinId) {
            throw new Error('coinId is a required value');
        }

        tradingBotsTracker.stopBotForUser(email, TradingBotsTracker.botTypes.grid, platform, {
            coinId
        }, false);

        res.send('{}', 204);
    } catch (e) {
        res.status(500).send(JSON.stringify(e, Object.getOwnPropertyNames(e)));
    }
});

app.post('/api/:platform/startArbitrageBot', auth.required, (req, res) => {
    try {
        const {tradingPairs, comparePair, checkInterval = 30, amount} = req.body;

        const {platform, id} = req.params;

        const {email} = req.user;

        if (!tradingPairs || !Array.isArray(tradingPairs)) {
            throw new Error('tradingPairs is a required paramater and must be an Array');
        }

        if (!comparePair) {
            throw new Error('comparePair is a required value');
        }

        if (!amount) {
            throw new Error('amount is a required value');
        }

        const platformInstance = getTradingPlatform(req);

        tradingBotsTracker.startBotForUser(email, id, TradingBotsTracker.botTypes.arbitrage, platform, platformInstance, {
            tradingPairs,
            comparePair,
            checkInterval,
            amount
        });

        res.send('{}', 204);
    } catch (e) {
        res.status(500).send(JSON.stringify(e, Object.getOwnPropertyNames(e)));
    }
});

app.post('/api/:platform/stopArbitrageBot', auth.required, (req, res) => {
    try {
        const {tradingPairs, comparePair, checkInterval = 30, amount} = req.body;

        const {platform} = req.params;

        const {email} = req.user;

        const soft = req.query.soft || false;

        tradingBotsTracker.stopBotForUser(email, TradingBotsTracker.botTypes.arbitrage, platform, {
            tradingPairs,
            comparePair,
            checkInterval,
            amount
        }, soft);

        res.send('{}', 204);
    } catch (e) {
        res.status(500).send(e.message);
    }
});

app.get('/api/savings-plans', auth.required, async (req, res) => {
    try {
        res.send(savingsPlanInstance.getExistingPlans(req.user.id));
    } catch (e) {
        res.status(500).send(e.message);
    }
});

app.post('/api/savings-plans', auth.required, async (req, res) => {
    try {
        const {platformName, tradingPair, amount, currency, frequencyUnit, frequencyValue} = req.body;

        if (!platformName || !tradingPair || !amount || !currency) {
            throw new Error('platformName, tradingPair, currency and amount are mandatory parameters');
        }

        if (!tradingPair.split('/').some(curr => curr === currency)) {
            throw new Error(`Provided currency ${currency} is invalid for trading pair ${tradingPair}. The currency must be part of the trading pair.`);
        }

        const {id} = await savingsPlanInstance.createPlan(req.user.id, platformName, tradingPair, amount, currency, frequencyUnit, frequencyValue);

        res.send({id});
    } catch (e) {
        res.status(500).send(e.message);
    }
});

app.put('/api/savings-plans/:id', auth.required, async (req, res) => {
    try {
        const {id} = req.params;

        const {amount, frequencyUnit, frequencyValue} = req.body;

        if (!id || !amount || !frequencyUnit || !frequencyValue) {
            throw new Error('id, amount, frequencyUnit and frequencyValue are mandatory parameters');
        }

        await savingsPlanInstance.updatePlan(req.user.id, id, amount, frequencyUnit, frequencyValue);

        res.send('{}', 204);
    } catch (e) {
        res.status(500).send(e.message);
    }
});

app.delete('/api/savings-plans/:id', auth.required, async (req, res) => {
    try {
        const {id} = req.params;

        await savingsPlanInstance.deletePlan(req.user.id, id);

        res.send({}, 204);
    } catch (e) {
        res.status(500).send(e.message);
    }
});

app.get('/api/:platform/meta', auth.required, async (req, res) => {
    try {
        const {platform} = req.params;

        const supportedCoins = tradingPlatforms[platform].supportedCoins;

        const supportedCoinsArr = Object.keys(tradingPlatforms[platform].supportedCoins).map(key => ({
            id: key,
            ...supportedCoins[key]
        }));

        res.send({
            supportedCoins: supportedCoinsArr
        });
    } catch (e) {
        res.status(500).send(e.message);
    }
});

app.get('/api/:platform/balance', auth.required, async (req, res) => {
    try {
        const platformInstance = getTradingPlatform(req);

        const balance = await platformInstance.getBalance();

        res.send(balance);
    } catch (e) {
        res.status(500).send(e.message);
    }
});

app.get('/api/:platform/meta/:coinId', auth.required, async (req, res) => {
    const {coinId} = req.params;

    const platformInstance = getTradingPlatform(req);

    try {
        res.send(await platformInstance.getCoinMetadata(coinId));
    } catch (e) {
        res.send(e.message, 500);
    }

});

app.get('/api/:platform/meta', auth.required, async (req, res) => {
    try {
        const platformInstance = getTradingPlatform(req);

        res.send(await platformInstance.getCoinMetadata());
    } catch (e) {
        res.send(e.message, 500);
    }
});


app.get('/api/:platform/meta/user/:userId', auth.required, async (req, res) => {
    try {
        const {userId} = req.params;

        const platformInstance = getTradingPlatform(req);

        res.send(await platformInstance.getCoinMetadata(userId));
    } catch (e) {
        res.send(e.message, 500);
    }
});


app.get('/api/:platform/currentTicker/:coinId', auth.required, async (req, res) => {
    const {coinId} = req.params;

    const platformInstance = getTradingPlatform(req);

    res.send(await platformInstance.fetchTicker(coinId));
});

app.get('/api/:platform/history/:coinId', auth.required, async (req, res) => {
    const {coinId} = req.params;

    const platformInstance = getTradingPlatform(req);

    try {
        res.send(await platformInstance.getTickerHistory(coinId));
    } catch (e) {
        res.send(e.message, 500);
    }
});

app.get('/api/:platform/trades/:coinId', auth.required, async (req, res) => {
    const {coinId} = req.params;

    const platformInstance = getTradingPlatform(req);

    try {
        res.send(await platformInstance.getRecentTrades(coinId));
    } catch (e) {
        res.send(e.message, 500);
    }
});

app.post('/api/:platform/add-user-info', auth.required, async (req, res) => {
    try {
        const platformInstance = getTradingPlatform(req);

        await platformInstance.login(req.body);

        res.send({}, 204);
    } catch (e) {
        res.send(e.message, 500);
    }
});

app.post('/api/:platform/cancelAllOrders', auth.required, async (req, res) => {
    try {
        const platformInstance = getTradingPlatform(req);

        const result = await platformInstance.cancelAllOrders();

        res.send({result});
    } catch (e) {
        res.send(e.message, 500);
    }
});

app.post('/api/:platform/order', auth.required, async (req, res) => {
    try {
        const platformInstance = getTradingPlatform(req);

        const {coinId, price, amount, action = 'sell', type = 'limit'} = req.body;

        const resp = await platformInstance.createOrder(coinId, price, amount, action, type);

        res.send(resp);
    } catch (e) {
        res.send(e.message, 500);
    }
});


app.post('/api/:platform/opportunity/realise', auth.required, async (req, res) => {
    try {
        const platformInstance = getTradingPlatform(req);

        const {tradingPairs, comparePair, checkInterval = 30, amount} = req.body;

        if (!tradingPairs || !Array.isArray(tradingPairs)) {
            throw new Error('tradingPairs is a required paramater and must be an Array');
        }

        if (!comparePair) {
            throw new Error('comparePair is a required value');
        }

        if (!amount) {
            throw new Error('amount is a required value');
        }

        const fn = async () => {
            console.log('Start tracking');

            while (true) {
                const currentOpp = await checkOpportunity(platformInstance, tradingPairs, comparePair);

                // We only react to opportunities with at least 1% margin

                // If the opportunity is higher, buy from the simple pair and sell the circular pairs
                if (currentOpp.positiveOpp - 1 > 0.01) {
                    console.log('Positive Opportunity found:');
                    console.log(currentOpp);

                    try {

                        tradingPairs.forEach(async ({id}) => {
                            const calcValue = amount * (currentOpp.comparePair.ask / currentOpp.currentTickers[id].bid);

                            console.log(`Selling ${calcValue} of coin ${id}`);

                            await platformInstance.createOrder(id, 0, calcValue, 'sell', 'market');
                        });

                        console.log(`Buying ${amount} of coin ${comparePair}`);

                        platformInstance.createOrder(comparePair, 0, amount, 'buy', 'market')

                    } catch (e) {
                        console.log(e);
                        throw e;
                    }

                    // Opposite opportunity, buy from the circular pairs and sell the simple pair
                } else if (currentOpp.negativeOpp - 1 > 0.01) {
                    console.log('Negative Opportunity found:');
                    console.log(currentOpp);

                    try {
                        tradingPairs.forEach(async ({id}) => {
                            const calcValue = amount * (currentOpp.comparePair.bid / currentOpp.currentTickers[id].ask);

                            console.log(`Selling ${calcValue} of coin ${id}`);

                            platformInstance.createOrder(id, 0, calcValue, 'buy', 'market')
                        });

                        console.log(`Buying ${amount} of coin ${comparePair}`);

                        platformInstance.createOrder(comparePair, 0, amount, 'sell', 'market')

                    } catch (e) {
                        console.log(e);
                        throw e;
                    }
                }

                await utils.timeout(1000 * checkInterval);
            }
        };

        fn();

        res.send('{}', 204);
    } catch (e) {
        res.send(e);
    }
});

app.post('/api/:platform/opportunity', auth.required, async (req, res) => {
    try {
        const platformInstance = getTradingPlatform(req);

        const {tradingPairs, comparePair} = req.body;

        if (!tradingPairs || !Array.isArray(tradingPairs)) {
            throw new Error('tradingPairs is a required paramater and must be an Array');
        }

        if (!comparePair) {
            throw new Error('comparePair is a required value');
        }

        res.send(await arbitrageOpportunity.checkOpportunity(platformInstance, tradingPairs, comparePair));

    } catch (e) {
        res.send(e.message, 500);
    }
});

app.get('/api/:platform/order/id/:orderId/coin/:coinId', auth.required, async (req, res) => {
    try {
        const {orderId, coinId} = req.params;

        const platformInstance = getTradingPlatform(req);

        const resp = await platformInstance.fetchOrder(orderId, coinId);

        res.send(resp);
    } catch (e) {
        res.send(e.message, 500);
    }
});

app.get('/api/:platform/my-trades/coin/:coinId', auth.required, async (req, res) => {
    try {
        const {coinId} = req.params;

        const {hours = undefined} = req.query;

        const platformInstance = getTradingPlatform(req);

        const resp = await platformInstance.getMyTrades(coinId, hours);

        res.send(resp);
    } catch (e) {
        res.send(e.message, 500);
    }
});

app.get('/api/:platform/my-trades/coin/:coinId/hours/:hours', auth.required, async (req, res) => {
    try {
        const {coinId, hours} = req.params;

        const platformInstance = getTradingPlatform(req);

        const {trades, ticker, minutesUp, marketId} = await platformInstance.getMyTrades(coinId, hours);

        const aggregatedTrades = tradingAnalytics.aggregateMyTrades(coinId, marketId, minutesUp, trades, ticker);

        res.send(aggregatedTrades);
    } catch (e) {
        res.send(e.message, 500);
    }
});

const aggregatedTransactions = async ({req, client, dif, uuids, tradingPair}) => {

    // As our platform api is using hour is unit, convert difference between the 2 dates in ms to hours
    const divider = 1000 * 60 * 60;

    // Add a little buffer of 5 minutes, to ensure that there are no rounding errors or the async logging creation timestamp causes problems
    const hoursSinceBotWasStarted = (dif + 5 * 1000) / divider;

    const platformInstance = getTradingPlatform(req);

    const {trades, ticker, marketId} = await platformInstance.getMyTrades(tradingPair || undefined, hoursSinceBotWasStarted);

    const result = await client.query('select platform_transaction_id from bot_platform_transaction_log where uuid = ANY($1)', [uuids]);

    const platformTransactionIds = result.rows.map(({platform_transaction_id}) => platform_transaction_id);

    const transactionIdsSet = new Set(platformTransactionIds);

    const filteredTrades = trades.filter(trade => transactionIdsSet.has(trade.order));

    return tradingAnalytics.aggregateMyTrades(tradingPair, marketId, 0, filteredTrades, ticker);
};

app.get('/api/bots', auth.required, async(req, res) => {
   await databaseClientWrapper(async (client) => {
       try {
           const {active} = req.query;

           const query = 'select uuid, bot_type, platform_name, additional_info, active from bot_log where user_id = $1';

           const optionalWhere = () => ` and active = ${active ? 1 : 0}`;

           const result = await client.query(`${query}${active !== undefined ? optionalWhere() : ''}`, [req.user.id]);

           res.send(result.rows);
       } catch (e) {
           res.status(500).send(e.message);
       }
   });
});

const databaseClientWrapper = async (fn) => {
    let client;

    try {
        client = await pool.connect();
        await fn(client);
    } finally {
        if (client) {
            client.release();
        }
    }
};

app.get('/api/bot-trades/platform/:platform/type/:botType/trading-pair/:tradingPair', auth.required, async (req, res) => {
   let client;

   try {
     const { platform, botType, tradingPair } = req.params;

     const {top} = req.query;

     if (!platform || !botType || !tradingPair) {
         throw new Error('The parameters platformId, botType and tradingPair are mandatory!');
     }

     client = await pool.connect();

     let result = await client.query(`select created_at, additional_info->'coinId' as trading_pair, platform_name, uuid from bot_log 
        where user_id = $1 and platform_name = $2 and bot_type = $3 and (additional_info->>'coinId') = $4 order by created_at desc ${top ? `limit ${top}`: ''}`,
         [req.user.id, platform, botType, tradingPair]);

       if (!result.rows.length) {
           throw new Error(`No bots were found for the given config parameters`);
       }

       // as we have ordered the bots by creation date asc, the first entry is the oldest timestamp
       const oldestBotCreationDate = result.rows[result.rows.length - 1].created_at;

       const dif = new Date().getTime() - new Date(oldestBotCreationDate);

       const uuids = result.rows.map(({uuid}) => uuid);

       res.send(await aggregatedTransactions({req, client, dif, uuids, tradingPair}));
   } catch (e) {
       res.status(500).send(e.message);
   } finally {
       if (client) {
           client.release();
       }
   }
});

app.get('/api/bot-trades/:botUuid', auth.required, async (req, res) => {
    let client;

   try {
       const {botUuid} = req.params;

       if (!botUuid) {
           throw new Error('The bot uuid is a required path param!');
       }

       client = await pool.connect();

       let result = await client.query(`select created_at, additional_info->'coinId' as trading_pair, platform_name from bot_log where user_id = $1 and uuid = $2`, [req.user.id, botUuid]);

       if (!result.rows.length) {
           throw new Error(`No bot with uuid ${botUuid} was found for the current session user.`);
       }

       // As the uuid is the primary key of the table, it's safe to assume that we either have no result or exactly 1.
       const botCreationDate = result.rows[0].created_at;

       const dif = new Date().getTime() - new Date(botCreationDate);

       const tradingPair = result.rows[0].trading_pair;
       const platformName = result.rows[0].platform_name;

       // The method assumes that the request contains a parameter 'platformId', manually construct an object here to conform to this structure
       const modifiedReq = {
           ...req,
           params: {
               ...req.params,
               platform: platformName
           }
       };

       res.send(await aggregatedTransactions({req: modifiedReq, client, dif, uuids:[botUuid], tradingPair}));

   } catch (e) {
       res.status(500).send(e.message);
   } finally {
       if (client) {
           client.release();
       }
   }
});

const past5YearsInHours = 5 * 365 * 24;

app.get('/api/:platform/my-trades', auth.required, async (req, res) => {
    try {
        const {top = 10, since = past5YearsInHours} = req.query;

        const platformInstance = getTradingPlatform(req);

        res.send(await platformInstance.getMyTrades(undefined, since, top));
    } catch (e) {
        res.send(e.message, 500);
    }
});

app.get('/api/:platform/trades/user/:userId/coin/:coinId/since-tracking-start', auth.required, async (req, res) => {
    try {
        const {userId, coinId} = req.params;

        const platformInstance = getTradingPlatform(req);

        const resp = await platformInstance.ndax.getMyTrades(coinId, userId, null, true);

        res.send(resp);
    } catch (e) {
        res.send(e.message, 500);
    }
});

app.post('/api/platform', auth.required, auth.adminOnly, async (req, res) => {
    let client;

    try {
        const {name, id} = req.body;

        if (!name || !id) {
            res.status(400).send('Id and name are required paramters');
        } else {
            client = await pool.connect();

            await client.query('Insert into platforms (id, decription) value ($1, $2)', [id, name]);

            res.status(204).send();
        }
    } catch (e) {
        res.send(e.message, 500);
    } finally {
        client.release();
    }
});


app.post('/api/platform/:id/active/:active', auth.required, auth.adminOnly, async (req, res) => {
    try {
        const {id, active} = req.param;

        await client.query('Update platforms set active = $1 where id = $2', [active, id]);

        res.status(204).send();
    } catch (e) {
        res.send(e.message, 500);
    }
});

app.get('/api/platform', auth.required, async (req, res) => {
    let client;
    try {
        client = await pool.connect();

        const result = await client.query('SELECT id, description, currently_active FROM platforms');

        const mappedResp = result.rows.map(row => ({
            id: row.id,
            description: row.description,
            active: !!row.currently_active,
            userCredentialsAvailable: !!req.user.accountMappings[row.id],
            platformUserId: !!req.user.accountMappings[row.id] ? req.user.accountMappings[row.id].userId : null
        }));

        res.send(mappedResp);
    } catch (e) {
        res.send(e.message, 500);
    } finally {
        if (client) {
            client.release();
        }
    }
});

/*
app.get('/api/test/db', async (req, res) => {
    let client;
    try {
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false
            }
        });

        client = await pool.connect();
        const result = await client.query('SELECT * FROM test_table');
        const results = {'results': (result) ? result.rows : null};

        res.send(results);
    } catch (err) {
        console.error(err);
        res.send("Error " + err);
    } finally {
        if (client) {
            client.release();
        }
    }
});
 */

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname + '/client/public/index.html'));
});


app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
});
