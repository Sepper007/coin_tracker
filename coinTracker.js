const ccxt = require('ccxt');

// Use this NDAX instance for any public API endpoints
const readOnlyNDAXInstance = new ccxt.ndax();

const ndaxInstanceUserMap = {};

let openOrders = [];

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
            amount: amount,
            since: Date.now()
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

module.exports = coinTracker;
