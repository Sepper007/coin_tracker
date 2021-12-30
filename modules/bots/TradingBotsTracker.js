const MarketSpreadBot = require('./MarketSpreadBot');
const ArbitrageBot = require('./ArbitrageBot');
const GridBot = require('./GridBot');
const TradingBotActivityLog = require('./TradingBotActivityLog');
const arbitrageOpportunity = require('../arbitrageOpportunity');
const PubSub = require('pubsub-js');

class TradingBotsTracker {
    static botTypes = {
        marketSpread: 'marketSpread',
        arbitrage: 'arbitrage',
        grid: 'grid'
    };

    constructor() {
        this.activeBots = {};
    }

    startBotForUser(userEmail, userId, botType, platFormName, tradingPlatformInstance, parameters) {

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
                    userEmail,
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
                    userEmail,
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
            case TradingBotsTracker.botTypes.grid: {
                const {
                    fetchTicker,
                    createOrder,
                    getMinimumQuantity
                } = tradingPlatformInstance;

                const {coinId, maximumInvestment, numberOfGrids, percentagePerGrid, startingPrice, strategy} = parameters;

                bot = new GridBot(
                    userEmail,
                    userId,
                    platFormName,
                    coinId,
                    maximumInvestment,
                    // Bind all functions to the initial instance of the tradingPlatform, to prevent any issue with the this-context at runtime
                    fetchTicker.bind(tradingPlatformInstance),
                    // Encapsulate all user-id specific methods here, so the bot instance doesn't have to know the user-id
                    // !!!! IMPORTANT: don't use arrow-functions here, as you can't manually override the this context !!!!
                    (...params) => createOrder.bind(tradingPlatformInstance)(...params),
                    (...params) => getMinimumQuantity.bind(tradingPlatformInstance)(...params),
                    numberOfGrids,
                    percentagePerGrid,
                    startingPrice,
                    strategy
                );
                break;
            }
            default:
                throw new Error(`Bot Type ${botType} is not supported`);
        }

        bot.run();

        const id = bot.getId();

        PubSub.publish(`${TradingBotActivityLog.BOT_CUD_TOPIC_IDENTIFIER}.${TradingBotActivityLog.BOT_CUD_EVENT.CREATE}`, {
                uuid: bot.uuid,
                userId,
                botType,
                additionalInfo: parameters
            }
        );


        if (this.activeBots[id]) {
            // There is already a bot running for the user, stop the existing one
            console.log(`There is already a bot running with the given parameters, stopping existing bot`);
            this.activeBots[id].instance.stop();
        }

        this.activeBots[id] = {running: true, softShutdown: false, instance: bot};
    }

    stopBotForUser(userEmail, botType, platformName, parameters, soft) {
        let id;

        switch (botType) {
            case TradingBotsTracker.botTypes.marketSpread: {
                const {coinId} = parameters;

                id = MarketSpreadBot.generateId(platformName, userEmail, coinId);

                break;
            }
            case TradingBotsTracker.botTypes.arbitrage: {
                const {userEmail, tradingPairs, comparePair} = parameters;

                id = ArbitrageBot.generateId(platformName, userEmail, tradingPairs, comparePair);

                break;
            }
            case TradingBotsTracker.botTypes.grid: {
                const {coinId} = parameters;

                id = GridBot.generateId(platformName, userEmail, coinId);
                break;
            }
            default:
                throw new Error(`Bot Type ${botType} is not supported`);
        }

        if (this.activeBots[id]) {
            this.activeBots[id].instance.stop(soft);

            PubSub.publish(`${TradingBotActivityLog.BOT_CUD_TOPIC_IDENTIFIER}.${TradingBotActivityLog.BOT_CUD_EVENT.STOP}`, {
                    uuid: this.activeBots[id].instance.uuid
                }
            );

            delete this.activeBots[id];
        }
    }
}

module.exports = TradingBotsTracker;
