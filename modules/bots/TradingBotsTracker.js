const MarketSpreadBot = require('./MarketSpreadBot');
const ArbitrageBot = require('./ArbitrageBot');
const arbitrageOpportunity = require('../arbitrageOpportunity');

class TradingBotsTracker {
    static botTypes = {
        marketSpread: 'marketSpread',
        arbitrage: 'arbitrage'
    };

    constructor() {
        this.activeBots = {};
    }

    startBotForUser(userId, botType, platFormName, tradingPlatformInstance, parameters) {

        let bot;

        switch (botType) {
            case TradingBotsTracker.botTypes.marketSpread: {
                const {
                    getRecentTrades,
                    fetchTicker,
                    fetchOrder,
                    createOrder,
                    editOrder,
                    getMinimumQuantity
                } = tradingPlatformInstance;

                const {coinId, amount} = parameters;

                bot = new MarketSpreadBot(
                    // FIXME: Add actual user-email logic
                    'sebastian_oberhauser@web.de',
                    platFormName,
                    coinId,
                    amount,
                    // Bind all functions to the initial instance of the tradingPlatform, to prevent any issue with the this-context at runtime
                    getRecentTrades.bind(tradingPlatformInstance),
                    fetchTicker.bind(tradingPlatformInstance),
                    // Encapsulate all user-id specific methods here, so the bot instance doesn't have to know the user-id
                    // !!!! IMPORTANT: don't use arrow-functions here, as you can't manually override the this context !!!!
                    (...params) => fetchOrder.bind(tradingPlatformInstance)(...params),
                    (...params) => createOrder.bind(tradingPlatformInstance)(...params),
                    (...params) => editOrder.bind(tradingPlatformInstance)(...params),
                    (...params) => getMinimumQuantity.bind(tradingPlatformInstance)(...params)
                );
                break;
            }
            case TradingBotsTracker.botTypes.arbitrage: {
                const {amount, tradingPairs, comparePair, checkInterval} = parameters;

                bot = new ArbitrageBot(
                    // FIXME: Add actual user-email logic
                    'sebastian_oberhauser@web.de',
                    platFormName,
                    tradingPlatformInstance,
                    amount,
                    arbitrageOpportunity.checkOpportunity,
                    tradingPairs,
                    comparePair,
                    checkInterval
                );

                break;
            }
            default:
                throw new Error(`Bot Type ${botType} is not supported`);
        }

        bot.run();

        const id = bot.getId();


        if (this.activeBots[id]) {
            // There is already a bot running for the user, stop the existing one
            console.log(`There is already a bot running with the given parameters, stopping existing bot`);
            this.activeBots[id].instance.stop();
        }

        this.activeBots[id] = {running: true, softShutdown: false, instance: bot};
    }

    stopBotForUser(botType, parameters) {
        let id;

        switch (botType) {
            case TradingBotsTracker.botTypes.marketSpread: {
                const {platformName, userEmail, coinId} = parameters;

                id = MarketSpreadBot.generateId(platformName, userEmail, coinId);

                break;
            }
            case TradingBotsTracker.botTypes.arbitrage: {
                const {platformName, userEmail, tradingPairs, comparePair} = parameters;

                id = ArbitrageBot.generateId(platformName, userEmail, tradingPairs, comparePair);

                break;
            }
            default:
                throw new Error(`Bot Type ${botType} is not supported`);
        }

        this.activeBots[id].instance.stop();

        delete this.activeBots[id];
    }
}

module.exports = TradingBotsTracker;
