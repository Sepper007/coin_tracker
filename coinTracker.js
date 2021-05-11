const ccxt = require('ccxt');

// Use this NDAX instance for any public API endpoints
const readOnlyNDAXInstance = new ccxt.ndax();

const ndaxInstanceUserMap = {};

let openOrders = [];

const logIntoNDAXAccount = (apiKey, apiSecret, userId) => {
    ndaxInstanceUserMap[userId] = new ccxt.ndax({
        apiKey: apiKey,
        secret: apiSecret,
        uid: userId
    });
};

const supportedCoins = {
    doge: {
        marketId: 'DOGE/CAD',
        metaId: 'DOGE'
    },
    xrp: {
        marketId: 'XRP/CAD',
        metaId: 'XRP'
    }
};

let isTracking = Object.keys(supportedCoins).reduce((obj, val) => {
    obj[val] = {};

    return obj;
}, {});

const getCoinMetaId = (coinId) => {
    const mappedCoin = supportedCoins[coinId];

    if (!mappedCoin) {
        throw new Error(`Coin ${coinId} is not supported, the list of supported coins is: ${Object.keys(supportedCoins).join(',')}`);
    }

    return mappedCoin.metaId;
};

const getCoinMarketId = (coinId) => {
    const mappedCoin = supportedCoins[coinId];

    if (!mappedCoin) {
        throw new Error(`Coin ${coinId} is not supported, the list of supported coins is: ${Object.keys(supportedCoins).join(',')}`);
    }

    return mappedCoin.marketId;
};

const coinTracker = {
    start: (coinId, userId, amount) => {
        console.log(`Start tracking coin ${coinId} for user ${userId} with amount ${amount}`);

        isTracking[coinId][userId] = {
            tracking: true,
            amount: amount
        };
    },
    stop: (coinId, userId) => {
        console.log(`Stop tracking coin ${coinId} for user ${userId}`);

        // Remove any open orders for the given user and coin id
        openOrders = openOrders.filter(order => !(order.userId === userId && order.coinId === coinId));

        isTracking[coinId][userId] = {
            tracking: false
        };
    },
    status: (userId, coinId) => {
        if (userId && coinId) {
            return isTracking[coinId][userId];
        }
        return isTracking;
    },
    login: async (params) => {
        const {apiKey, secret, uid} = params;

        if (!apiKey || !secret || !uid) {
            throw new Error('The parameters apiKey, secret and uid are required')
        }

        logIntoNDAXAccount(params.apiKey, params.secret, params.uid);
    },
    cancelAllOrders: async (userId) => {
        const userSpecificNDAXInstance = ndaxInstanceUserMap[userId];

        if (!userSpecificNDAXInstance) {
            throw new Error(`User with id ${userId} is not logged in`);
        }

        await userSpecificNDAXInstance.cancelAllOrders();
    },
    createOrder: async (userId, coinId, price, amount, action = 'sell', type = 'limit') => {
        const userSpecificNDAXInstance = ndaxInstanceUserMap[userId];

        if (!userSpecificNDAXInstance) {
            throw new Error(`User with id ${userId} is not logged in`);
        }

        return await userSpecificNDAXInstance.createOrder(getCoinMarketId(coinId), type, action, amount, price);
    },
    editOrder: async (userId, coinId, orderId, price, amount, action = 'sell', type = 'limit') => {
        const userSpecificNDAXInstance = ndaxInstanceUserMap[userId];

        if (!userSpecificNDAXInstance) {
            throw new Error(`User with id ${userId} is not logged in`);
        }

        return await userSpecificNDAXInstance.editOrder(orderId, getCoinMarketId(coinId), type, action, amount, price);
    },
    fetchOrder: async (userId, orderId) => {
        const userSpecificNDAXInstance = ndaxInstanceUserMap[userId];

        if (!userSpecificNDAXInstance) {
            throw new Error(`User with id ${userId} is not logged in`);
        }

        return await userSpecificNDAXInstance.fetchOrder(orderId);
    },
    getCoinMetadata: async (coinId) => {
        let metaId;

        if (coinId) {
            metaId = getCoinMetaId(coinId);
        }

        const resp = await readOnlyNDAXInstance.fetchCurrencies();

        if (metaId) {
            return resp[metaId];
        }

        return resp;
    },
    fetchTicker: async (coinId) => {
        const marketId = getCoinMarketId(coinId);

        return await readOnlyNDAXInstance.fetchTicker(marketId);
    },
    getTickerHistory: async (coinId, from, to) => {
        const marketId = getCoinMarketId(coinId);

        // Fetch the ticker values for the last days hours, broken down by the minute
        return await readOnlyNDAXInstance.fetchOHLCV(marketId, '1m', Date.now() - (2 * 24 * 60 * 60 * 1000))
    },
    getRecentTrades: async (coinId) => {
        const marketId = getCoinMarketId(coinId);

        // Get the last 100 trades
        return await readOnlyNDAXInstance.fetchTrades(marketId, null, 200);
    }
};

const timeout = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const polling = async () => {
    const coinIds = Object.keys(supportedCoins);

    checkOpenOrders();

    await timeout(5 * 1000);

    checkMarketForNewDips(coinIds);
};

const getLast10RelevantTrades = async (coinId) => {
    const trades = await coinTracker.getRecentTrades(coinId);

    const relevantTrades = trades.filter(trade => trade.amount >= 100);

    // Splice changes the array, so the "leftover" entries are any trades apart from the last 10
    return relevantTrades.splice(relevantTrades.length - 10, relevantTrades.length);
};

const getLast10RevelantTradesAveragePrice = async (coindId) => {
   const resp = await getLast10RelevantTrades(coindId);

   return resp.map(trade => trade.price).reduce((sum, val) => sum + val, 0) / resp.length;
};

const checkOpenOrders = async () => {
    let order, fetchedOrder;

    while (true) {
        await timeout(10 * 1000);

        for (let i = 0; i < openOrders.length; i++) {
            order = openOrders[i];

            const {userId, coinId, price, orderId} = order;

            try {
                fetchedOrder = await coinTracker.fetchOrder(userId, orderId);
            } catch (e) {
                console.log(`fetching order ${orderId} failed, skipping sell logic for now`);
                continue;
            }

            if (fetchedOrder.info.OrderState === 'FullyExecuted') {

                // Last order was sell order, clear the order array to allow for new buy orders
                if (order.type === 'sell') {
                    openOrders.splice(i, 1);

                    // Reset index after we removed an array entry
                    i--;
                } else {
                    // Last order was buy order, add subsequent sell oder

                    console.log(`Buy order for user ${userId} and coinId ${coinId} was fully executed, add limit stop oder`);

                    try {
                        const currentTicker = await coinTracker.fetchTicker(coinId);

                        const sellPrice = Math.max(price * 1.005, currentTicker.ask - 0.001);

                        // Add sell order 0.5% above the price where we bought it
                        const sellOrder = await coinTracker.createOrder(userId, coinId, sellPrice, fetchedOrder.amount, 'sell', 'limit');

                        // Remove old entry with new one
                        openOrders[i] = {
                            userId: userId,
                            coinId: coinId,
                            amount: fetchedOrder.amount,
                            orderId: sellOrder.id,
                            price: sellPrice,
                            type: 'sell'
                        };

                    } catch (e) {
                        console.log(`Creating Sell order for user ${userId} and coinId ${coinId} failed, skipping logic for now`);
                    }
                }


            } else {
                // Order wasn't fully processed yet, check if order shall be changed to unblock the bot

                if (order.type === 'sell') {
                    // Check if sell order was placed more than 1 minute ago
                    if (Date.now() - fetchedOrder.timestamp >= 1000 * 60 * 2) {
                        // if so cut your losses, and change the sell price

                        try {
                            console.log(`Unprocessed sell order for user ${userId} and coin ${coinId} is blocking the execution, adjust sell price to unblock bot`);

                            const last10TradesAveragePrice = await getLast10RevelantTradesAveragePrice(coinId);

                            const currentTicker = await coinTracker.fetchTicker(coinId);

                            const sellPrice = Math.max(last10TradesAveragePrice, currentTicker.ask - 0.001);

                            const newOrder = await coinTracker.editOrder(userId, coinId, orderId, sellPrice, fetchedOrder.amount, 'sell', 'limit');

                            // Update order object to new id:
                            order.orderId = newOrder.id;
                        } catch (e) {
                            console.log(`Fetching the recent trades failed for coin ${coinId} with the following error msg: ${e.message}`);
                        }
                    }
                } else {
                    // Buy order is currently being executed
                    // Check if buy order was placed more than 1 minute ago
                    if (Date.now() - fetchedOrder.timestamp >= 1000 * 60) {
                        // if so change the buy price to unlock the bot
                        try {
                            console.log(`Unprocessed buy order for user ${userId} and coin ${coinId} is blocking the execution, adjust buy price to unblock bot`);

                            const last10TradesAveragePrice = await getLast10RevelantTradesAveragePrice(coinId);

                            const currentTicker = await coinTracker.fetchTicker(coinId);

                            const buyPrice = Math.min(currentTicker.bid + 0.001,last10TradesAveragePrice * 0.995);

                            const newOrder = await coinTracker.editOrder(userId, coinId, orderId, buyPrice, fetchedOrder.amount, 'buy', 'limit');

                            order.orderId = newOrder.id;
                            order.price = buyPrice;

                        } catch (e) {
                            console.log(`Adjust buy order failed with the following error msg: ${e.message}`);
                        }
                    }

                }
            }

        }
    }


};

const checkMarketForNewDips = async (coinIds) => {
    while (true) {
        await timeout(10 * 1000);

        const trackedCoins = coinIds.filter(
            coinId => Object.values(isTracking[coinId]).some(obj => obj.tracking));

        // The overall strategy is to look for an overall negative trend, with the last 10 trades having a positive
        // trend "buying the dip"

        let coinId;

        for (let i = 0; i < trackedCoins.length; i++) {
            coinId = trackedCoins[i];

            let trades;
            try {
                trades = await coinTracker.getRecentTrades(coinId);
            } catch (e) {
                console.log(`Fetching recent trades for ${coinId} failed, skipping logic for now`);
                continue;
            }

            // Filter out any trades with less than 100 coins, as they are minor

            const relevantTrades = trades.filter(trade => trade.amount >= 100);

            // Splice changes the array, so the "leftover" entries are any trades apart from the last 10
            const last10Trades = relevantTrades.splice(relevantTrades.length - 10, relevantTrades.length);

            if (last10Trades.length !== 10) {
                continue;
            }

            const last10TradesAveragePrice = last10Trades.map(trade => trade.price).reduce((sum, val) => sum + val, 0) / 10;

            const averages = [];

            let subGroup, groupAverage, numberOfPositiveTrends = 0;

            for (let i = 0; i < relevantTrades.length; i += 10) {
                // Put trades into chunk of 10 and build an average

                subGroup = relevantTrades.splice(0, 10);

                groupAverage = subGroup.map(trade => trade.price).reduce((sum, val) => sum + val, 0) / subGroup.length;

                averages.push(groupAverage);
            }

            // Check that averages are going down, allow 1 exception and make sure it overall went down more than 0.5%
            /*
            for (let i = 1; i < averages.length; i++) {
                if (averages[i] >= averages[i - 1]) {
                    numberOfPositiveTrends++;
                }
            }
             */

            let numberOfNegativeTrends = 0;

            // Check that averages are going down, allow 1 exception and make sure it overall went down more than 0.5%
            for (let i = 1; i < averages.length; i++) {
                if (averages[i] <= averages[i - 1]) {
                    numberOfNegativeTrends++;
                }
            }


            if (numberOfNegativeTrends >= 7) {
                console.log('Overall trend is very negative, skip buying order until market has stabilised');

                continue;
            }

            // It dropped by at least 1%

            if (numberOfPositiveTrends >= 7) {
                console.log('Overall trend is very negative, skip buying order until market has stabilised');
            } else
            //if (averages[0] / last10TradesAveragePrice >= 1.01) {
                for (const [userId, meta] of Object.entries(isTracking[coinId])) {
                    if (openOrders.some(order => order.userId === userId && order.coinId === coinId)) {
                        continue;
                    }

                    const currentTicker = await coinTracker.fetchTicker(coinId);

                    if (meta.tracking) {
                        console.log(`Making buy order for user ${userId} and coin ${coinId}`);

                        try {
                            // Use either the current lower ask or the rolling average - 0.5%
                            const buyPrice = Math.min(currentTicker.bid + 0.001,last10TradesAveragePrice * 0.995);

                            const order = await coinTracker.createOrder(userId, coinId, buyPrice, meta.amount, 'buy', 'limit');

                            openOrders.push({
                                userId: userId,
                                coinId: coinId,
                                amount: meta.amount,
                                orderId: order.id,
                                price: buyPrice,
                                type: 'buy'
                            });
                        } catch (e) {
                            console.log(`Creating buy order for user ${userId} and coinId ${coinId} failed with the following error msg: ${e.message}, skipping logic for now`);
                        }
                    }
                }
        }
    }
};

polling();

module.exports = coinTracker;
