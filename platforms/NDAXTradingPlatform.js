const ccxt = require('ccxt/ccxt');

class NDAXTradingPlatform {

    static readOnlyInstance = new ccxt.ndax();

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
        },
        btc_cad: {
            marketId: 'BTC/CAD',
            metaId: 'BTC',
            minimumQuantity: 0.0001
        },
        btc_usdt: {
            marketId: 'BTC/USDT',
            metaId: 'BTC',
            minimumQuantity: 0.0001
        },
        usdt_cad: {
            marketId: 'USDT/CAD',
            metaId: 'BTC',
            minimumQuantity: 10
        }
    };

    constructor(params) {
        this.login(params);
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

    login(params) {
        const {apiKey, secret, uid} = params;

        if (!apiKey || !secret || !uid) {
            throw new Error('The parameters apiKey, secret and uid are required')
        }

        this.userSpecificInstance = new ccxt.ndax({
            apiKey: apiKey,
            secret: secret,
            uid: uid
        });
    }

    async cancelAllOrders() {
        await this.userSpecificInstance.cancelAllOrders();
    }

    async createOrder(coinId, price, amount, action = 'sell', type = 'limit') {
        return await this.userSpecificInstance.createOrder(NDAXTradingPlatform.getCoinMarketId(coinId), type, action, amount, price);
    }

    async getBalance() {
        const { info } = await this.userSpecificInstance.fetchBalance();

        return info.filter(({ProductId}) => ProductId)
            .filter(({Amount}) => Amount > 0)
            .map(data => ({
                symbol: data.ProductSymbol,
                amount: data.Amount,
                notionalValue: data.NotionalValue,
                notionalCurrency: data.NotionalProductSymbol,
                rate: data.NotionalRate
                })
            )
            // Sort entries in descending order
            .sort((first, second) => second.notionalValue - first.notionalValue);
    }

    async editOrder(coinId, orderId, price, amount, action = 'sell', type = 'limit') {
        return await this.userSpecificInstance.editOrder(orderId, NDAXTradingPlatform.getCoinMarketId(coinId), type, action, amount, price);
    }

    async fetchOrder(orderId) {
        return await this.userSpecificInstance.fetchOrder(orderId);
    }

    async getCoinMetadata(coinId) {
        let metaId;

        if (coinId) {
            metaId = NDAXTradingPlatform.getCoinMetaId(coinId);
        }

        const resp = await NDAXTradingPlatform.readOnlyInstance.fetchCurrencies();

        if (metaId) {
            return resp[metaId];
        }

        return resp;
    }

    async fetchTicker(coinId) {
        const marketId = NDAXTradingPlatform.getCoinMarketId(coinId);

        return await NDAXTradingPlatform.readOnlyInstance.fetchTicker(marketId);
    }

    async getTickerHistory(coinId, from, to) {
        const marketId = NDAXTradingPlatform.getCoinMarketId(coinId);

        // Fetch the ticker values for the last days hours, broken down by the minute
        return await NDAXTradingPlatform.readOnlyInstance.fetchOHLCV(marketId, '1m', Date.now() - (2 * 24 * 60 * 60 * 1000))
    }

    async getRecentTrades(coinId) {
        const marketId = NDAXTradingPlatform.getCoinMarketId(coinId);

        // Get the last 200 trades
        return await NDAXTradingPlatform.readOnlyInstance.fetchTrades(marketId, null, 200);
    }

    async getMyTrades(coinId, hours = 2, sinceTrackingStart) {
        //const since = sinceTrackingStart ? NDAXTradingPlatform.isTracking()[coinId][userId].since : Date.now() - 1000 * 60 * 60 * hours;
        const since = Date.now() - 1000 * 60 * 60 * hours;

        const marketId = NDAXTradingPlatform.getCoinMarketId(coinId);

        const trades = await this.userSpecificInstance.fetchMyTrades(marketId, since);

        const ticker = await this.fetchTicker(coinId);

        const minutesUp = (Date.now() - since) / (60 * 1000);

        return { trades, ticker, minutesUp, marketId };
    }
}

module.exports = NDAXTradingPlatform;
