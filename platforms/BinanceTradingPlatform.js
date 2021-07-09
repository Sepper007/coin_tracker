const ccxt = require('ccxt/ccxt');

class BinanceTradingPlatform {

    static readOnlyInstance = new ccxt.binance();

    static supportedCoins = {
        doge: {
            marketId: 'DOGE/USDT',
            metaId: 'DOGE',
            minimumQuantity: 10
        },
        xrp: {
            marketId: 'XRP/USDT',
            metaId: 'XRP',
            minimumQuantity:10
        },
        eth: {
            marketId: 'ETH/USDT',
            metaId: 'ETH',
            minimumQuantity: 0.0001
        },
        ada: {
            marketId: 'ADA/USDT',
            metaId: 'ADA',
            minimumQuantity: 0.1
        },
        hard: {
            marketId: 'HARD/USDT',
            metaId: 'HARD',
            minimumQuantity: 10
        }
    };

    constructor(params) {
        this.login(params);
    }

    static getCoinMetaId(coinId) {
        const mappedCoin = BinanceTradingPlatform.supportedCoins[coinId];

        if (!mappedCoin) {
            throw new Error(`Coin ${coinId} is not supported, the list of supported coins is: ${Object.keys(BinanceTradingPlatform.supportedCoins).join(',')}`);
        }

        return mappedCoin.metaId;
    };

    static getCoinMarketId(coinId) {
        const mappedCoin = BinanceTradingPlatform.supportedCoins[coinId];

        if (!mappedCoin) {
            throw new Error(`Coin ${coinId} is not supported, the list of supported coins is: ${Object.keys(BinanceTradingPlatform.supportedCoins).join(',')}`);
        }

        return mappedCoin.marketId;
    };

    getMinimumQuantity(coinId) {
        const mappedCoin = BinanceTradingPlatform.supportedCoins[coinId];

        if (!mappedCoin) {
            throw new Error(`Coin ${coinId} is not supported, the list of supported coins is: ${Object.keys(BinanceTradingPlatform.supportedCoins).join(',')}`);
        }

        return mappedCoin.minimumQuantity;
    }

    login(params) {
        const {apiKey, secret, uid} = params;

        if (!apiKey || !secret || !uid) {
            throw new Error('The parameters apiKey, secret and uid are required')
        }

        this.userSpecificInstance = new ccxt.binance({
            apiKey: apiKey,
            secret: secret,
            uid: uid
        });
    }

    async cancelAllOrders() {
        await this.userSpecificInstance.cancelAllOrders();
    }

    async createOrder(coinId, price, amount, action = 'sell', type = 'limit') {
        return await this.userSpecificInstance.createOrder(BinanceTradingPlatform.getCoinMarketId(coinId), type, action, amount, price);
    }

    async editOrder(userId, coinId, orderId, price, amount, action = 'sell', type = 'limit') {
        return await this.userSpecificInstance.editOrder(orderId, BinanceTradingPlatform.getCoinMarketId(coinId), type, action, amount, price);
    }

    async fetchOrder(userId, orderId, coinId) {
        return await this.userSpecificInstance.fetchOrder(orderId, BinanceTradingPlatform.getCoinMarketId(coinId));
    }

    async getCoinMetadata(userId, coinId) {
        let metaId;

        if (coinId) {
            metaId = BinanceTradingPlatform.getCoinMetaId(coinId);
        }

        const resp = await this.userSpecificInstance.fetchCurrencies();

        if (metaId) {
            return resp[metaId];
        }

        return resp;
    }

    async fetchTicker(coinId) {
        const marketId = BinanceTradingPlatform.getCoinMarketId(coinId);

        return await BinanceTradingPlatform.readOnlyInstance.fetchTicker(marketId);
    }

    async getTickerHistory(coinId, from, to) {
        const marketId = BinanceTradingPlatform.getCoinMarketId(coinId);

        // Fetch the ticker values for the last days hours, broken down by the minute
        return await BinanceTradingPlatform.readOnlyInstance.fetchOHLCV(marketId, '1m', Date.now() - (2 * 24 * 60 * 60 * 1000))
    }

    async getRecentTrades(coinId) {
        const marketId = BinanceTradingPlatform.getCoinMarketId(coinId);

        // Get the last 200 trades
        return await BinanceTradingPlatform.readOnlyInstance.fetchTrades(marketId, Date.now() - (2 * 60 * 1000), 1000);
    }

    async getMyTrades(coinId, hours = 2, sinceTrackingStart) {
        // const since = sinceTrackingStart ? BinanceTradingPlatform.isTracking()[coinId][userId].since : Date.now() - 1000 * 60 * 60 * hours;

        const since = Date.now() - 1000 * 60 * 60 * hours;

        const marketId = BinanceTradingPlatform.getCoinMarketId(coinId);

        const trades = await this.userSpecificInstance.fetchMyTrades(marketId, since);

        const ticker = await this.fetchTicker(coinId);

        const minutesUp = (Date.now() - since) / (60 * 1000);

        return { trades, ticker, minutesUp, marketId };
    }
}

module.exports = BinanceTradingPlatform;
