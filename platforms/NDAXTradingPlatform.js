const ccxt = require('ccxt/ccxt');
const Utils = require('./utils');

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

    static defaultConversionCurrency = "CAD";

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
            // Also allow valid tradingPairs directly, e.g. ETH/CAD instead of eth
            if (Object.values(NDAXTradingPlatform.supportedCoins).some(coin => coin.marketId)) {
                return coinId;
            }

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

        const entries = info.filter(({ProductId}) => ProductId)
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

        const totalValue = entries.map(({notionalValue}) => notionalValue).reduce((sum, val) => sum + parseFloat(val), 0);

        return {
            total: {
                value: totalValue,
                // For now we assume that all entries that are returned use the same fiat currency
                currency: entries[0].notionalCurrency
            },
            holdings: entries,
            defaultCurrency: NDAXTradingPlatform.defaultConversionCurrency
        }
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

    async getMyTrades(coinId, hours = 2, max, sinceTrackingStart) {
        //const since = sinceTrackingStart ? NDAXTradingPlatform.isTracking()[coinId][userId].since : Date.now() - 1000 * 60 * 60 * hours;
        const since = Date.now() - 1000 * 60 * 60 * hours;

        const marketId = coinId ? NDAXTradingPlatform.getCoinMarketId(coinId) : undefined;

        const trades = await this.userSpecificInstance.fetchMyTrades(marketId, since, max);

        return trades.map(entry => ({
            symbol: entry.symbol,
            side: entry.side,
            type: entry.type,
            volume: entry.amount,
            price: entry.price,
            value: entry.cost,
            datetime: Utils.formatDate(entry.datetime)
            // The result is in ascending date order by default
        })).reverse();
    }
}

module.exports = NDAXTradingPlatform;
