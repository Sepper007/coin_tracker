const ccxt = require('ccxt/ccxt');

class NDAXTradingPlatform {

    static supportedCoins = {
        doge: {
            marketId: 'DOGE/CAD',
            metaId: 'DOGE',
            minimumQuantity: 10
        },
        xrp: {
            marketId: 'XRP/CAD',
            metaId: 'XRP',
            minimumQuantity:10
        },
        eth: {
            marketId: 'ETH/CAD',
            metaId: 'ETH',
            minimumQuantity: 0.0001
        },
        ada: {
            marketId: 'ADA/CAD',
            metaId: 'ADA',
            minimumQuantity: 0.1
        }
    };

    constructor() {
        this.readOnlyInstance = new ccxt.ndax();
        this.userSpecificInstances = {};
    }

    getInstanceForUser(userId) {
        if (!this.userSpecificInstances[userId]) {
            throw new Error(`User with id ${userId} isn't logged into Platform NDAX`);
        }

        return this.userSpecificInstances[userId];
    }

    static getCoinMetaId(coinId) {
        const mappedCoin = NDAXTradingPlatform.supportedCoins[coinId];

        if (!mappedCoin) {
            throw new Error(`Coin ${coinId} is not supported, the list of supported coins is: ${Object.keys(NDAXTradingPlatform.supportedCoins).join(',')}`);
        }

        return mappedCoin.metaId;
    };

    static getCoinMarketId(coinId) {
        const mappedCoin = NDAXTradingPlatform.supportedCoins[coinId];

        if (!mappedCoin) {
            throw new Error(`Coin ${coinId} is not supported, the list of supported coins is: ${Object.keys(NDAXTradingPlatform.supportedCoins).join(',')}`);
        }

        return mappedCoin.marketId;
    };

    getMinimumQuantity(coinId) {
        const mappedCoin = NDAXTradingPlatform.supportedCoins[coinId];

        if (!mappedCoin) {
            throw new Error(`Coin ${coinId} is not supported, the list of supported coins is: ${Object.keys(NDAXTradingPlatform.supportedCoins).join(',')}`);
        }

        return mappedCoin.minimumQuantity;
    }

    async login(params) {
        const {apiKey, secret, uid} = params;

        if (!apiKey || !secret || !uid) {
            throw new Error('The parameters apiKey, secret and uid are required')
        }

        this.userSpecificInstances[uid] = new ccxt.ndax({
            apiKey: apiKey,
            secret: secret,
            uid: uid
        });
    }

    async cancelAllOrders(userId) {
        const userSpecificNDAXInstance = this.userSpecificInstances[userId];

        if (!userSpecificNDAXInstance) {
            throw new Error(`User with id $ {userId}is not logged in`);
        }

        await userSpecificNDAXInstance.cancelAllOrders();
    }

    async createOrder(userId, coinId, price, amount, action = 'sell', type = 'limit') {
        const userSpecificNDAXInstance = this.userSpecificInstances[userId];

        if (!userSpecificNDAXInstance) {
            throw new Error(`User with id ${userId}is not logged in`);
        }

        return await userSpecificNDAXInstance.createOrder(NDAXTradingPlatform.getCoinMarketId(coinId), type, action, amount, price);
    }

    async editOrder(userId, coinId, orderId, price, amount, action = 'sell', type = 'limit') {
        const userSpecificNDAXInstance = this.userSpecificInstances[userId];

        if (!userSpecificNDAXInstance) {
            throw new Error(`User with id ${userId}is not logged in`);
        }

        return await userSpecificNDAXInstance.editOrder(orderId, NDAXTradingPlatform.getCoinMarketId(coinId), type, action, amount, price);
    }

    async fetchOrder(userId, orderId) {
        const userSpecificNDAXInstance = this.userSpecificInstances[userId];

        if (!userSpecificNDAXInstance) {
            throw new Error(`User with id ${userId}is not logged in`);
        }

        return await userSpecificNDAXInstance.fetchOrder(orderId);
    }

    async getCoinMetadata(coinId) {
        let metaId;

        if (coinId) {
            metaId = NDAXTradingPlatform.getCoinMetaId(coinId);
        }

        const resp = await this.readOnlyInstance.fetchCurrencies();

        if (metaId) {
            return resp[metaId];
        }

        return resp;
    }

    async fetchTicker(coinId) {
        const marketId = NDAXTradingPlatform.getCoinMarketId(coinId);

        return await this.readOnlyInstance.fetchTicker(marketId);
    }

    async getTickerHistory(coinId, from, to) {
        const marketId = NDAXTradingPlatform.getCoinMarketId(coinId);

        // Fetch the ticker values for the last days hours, broken down by the minute
        return await this.readOnlyInstance.fetchOHLCV(marketId, '1m', Date.now() - (2 * 24 * 60 * 60 * 1000))
    }

    async getRecentTrades(coinId) {
        const marketId = NDAXTradingPlatform.getCoinMarketId(coinId);

        // Get the last 200 trades
        return await this.readOnlyInstance.fetchTrades(marketId, null, 200);
    }

    async getMyTrades(coinId, userId, hours = 2, sinceTrackingStart) {
        const userSpecificNDAXInstance = this.userSpecificInstances[userId];

        if (!userSpecificNDAXInstance) {
            throw new Error(`User with id ${userId}is not logged in`);
        }

        const since = sinceTrackingStart ? NDAXTradingPlatform.isTracking()[coinId][userId].since : Date.now() - 1000 * 60 * 60 * hours;

        const trades = await userSpecificNDAXInstance.fetchMyTrades(NDAXTradingPlatform.getCoinMarketId(coinId), since);

        const ticker = await this.fetchTicker(coinId);

        const minutesUp = (Date.now() - since) / (60 * 1000);

        return { trades, ticker, minutesUp };
    }
}

module.exports = NDAXTradingPlatform;
