const NDaxTradingPlatform = require('../platforms/NDAXTradingPlatform');
const BinanceTradingPlaform = require('../platforms/BinanceTradingPlatform');

const tradingPlatforms = {
    ndax: NDaxTradingPlatform,
    binance: BinanceTradingPlaform
};

module.exports = tradingPlatforms;
