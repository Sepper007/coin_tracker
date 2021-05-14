const MarketSpreadBot = require('./MarketSpreadBot');

class TradingBotsTracker {
    static botTypes = {
        marketSpread: 'marketSpread'
    };

    constructor() {
        this.activeBots = {};
    }

    startBotForUser(userId, botType, platFormName, coinId, amount, tradingPlatformInstance) {
        switch (botType) {
            case TradingBotsTracker.botTypes.marketSpread:
                const {
                    getRecentTrades,
                    fetchTicker,
                    fetchOrder,
                    createOrder,
                    editOrder
                } = tradingPlatformInstance;


                const bot = new MarketSpreadBot(
                    // FIXME: Add actual user-email logic
                    'sebastian.oberhauser@web.de',
                    platFormName,
                    coinId,
                    amount,
                    getRecentTrades,
                    fetchTicker,
                    // Encapsulate all user-id specific methods here, so the bot instance doesn't have to know the user-id
                    (...params) => fetchOrder(userId, ...params),
                    (...params) => createOrder(userId, ...params),
                    (...params) => editOrder(userId, ...params)
                );

                if (this.activeBots[userId] && this.activeBots[userId][platFormName] && this.activeBots[userId][platFormName][botType]) {
                    if (this.activeBots[userId][platFormName][botType].running || this.activeBots[userId][platFormName][botType].running.softShutdown) {
                        // There is already a bot running for the user, stop the existing one
                        console.log(`There is already a bot running for user ${userId}, platform ${platFormName} and type ${botType}, stopping existing bot`);
                        this.activeBots[userId][platFormName][botType].instance.stop();
                    }
                }

                this.activeBots[userId] = {
                    ...this.activeBots[userId],
                    [platFormName]: {
                        ...this.activeBots[userId] && this.activeBots[userId][platFormName],
                        [botType]: {
                            running: true,
                            softShutdown: false,
                            instance: bot
                        }
                    }
                };

                break;
            default:
                throw new Error(`Bot Type ${botType} is not supported`);
        }
    }

    stopBotForUser(userId, platFormName, botType, soft = false) {
        // Check if bot exists and is currently running
        if (!(this.activeBots[userId] && this.activeBots[userId][platFormName] && this.activeBots[userId][platFormName][botType])) {
            throw new Error(`There is no bot running for user ${userId}, platform ${platFormName} and type ${botType}`);
        }

        this.activeBots[userId][platFormName][botType].stop(soft);

        delete this.activeBots[userId][platFormName][botType];
    }
}

module.exports = TradingBotsTracker;
