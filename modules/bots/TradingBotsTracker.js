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
                    editOrder,
                    getMinimumQuantity
                } = tradingPlatformInstance;


                const bot = new MarketSpreadBot(
                    // FIXME: Add actual user-email logic
                    'sebastian.oberhauser@web.de',
                    platFormName,
                    coinId,
                    amount,
                    // Bind all functions to the initial instance of the tradingPlatform, to prevent any issue with the this-context at runtime
                    getRecentTrades.bind(tradingPlatformInstance),
                    fetchTicker.bind(tradingPlatformInstance),
                    // Encapsulate all user-id specific methods here, so the bot instance doesn't have to know the user-id
                    // !!!! IMPORTANT: don't use arrow-functions here, as you can't manually override the this context !!!!
                    (...params) => fetchOrder.bind(tradingPlatformInstance)(userId, ...params),
                    (...params) => createOrder.bind(tradingPlatformInstance)(userId, ...params),
                    (...params) => editOrder.bind(tradingPlatformInstance)(userId, ...params),
                    (...params) => getMinimumQuantity.bind(tradingPlatformInstance)(...params)
                );

                if (this.activeBots[userId] && this.activeBots[userId][platFormName] && this.activeBots[userId][platFormName][botType] && this.activeBots[userId][platFormName][botType][coinId]) {
                    if (this.activeBots[userId][platFormName][botType].running || this.activeBots[userId][platFormName][botType].running.softShutdown) {
                        // There is already a bot running for the user, stop the existing one
                        console.log(`There is already a bot running for user ${userId}, platform ${platFormName}, type ${botType} and coin ${coinId}, stopping existing bot`);
                        this.activeBots[userId][platFormName][botType][coinId].instance.stop();
                    }
                }

                this.activeBots[userId] = {
                    ...this.activeBots[userId],
                    [platFormName]: {
                        ...this.activeBots[userId] && this.activeBots[userId][platFormName],
                        [botType]: {
                            ...this.activeBots[userId] && this.activeBots[userId][platFormName] && this.activeBots[userId][platFormName][botType],
                            [coinId]: {
                                running: true,
                                softShutdown: false,
                                instance: bot
                            }
                        }
                    }
                };

                break;
            default:
                throw new Error(`Bot Type ${botType} is not supported`);
        }
    }

    stopBotForUser(userId, botType, platFormName, coinId, soft = false) {
        // Check if bot exists and is currently running
        if (!(this.activeBots[userId] && this.activeBots[userId][platFormName] && this.activeBots[userId][platFormName][botType] && this.activeBots[userId][platFormName][botType][coinId]
            && this.activeBots[userId][platFormName][botType][coinId].running
        )) {
            throw new Error(`There is no bot running for user ${userId}, platform ${platFormName} and type ${botType}`);
        }

        this.activeBots[userId][platFormName][botType][coinId].instance.stop(soft);

        delete this.activeBots[userId][platFormName][botType][coinId];

        console.log(`Bot with type ${botType}, coin ${coinId} for platform ${platFormName} was stopped for user ${userId} `);
    }
}

module.exports = TradingBotsTracker;
