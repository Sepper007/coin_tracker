const utils = require('../utils');
const TradingBot = require('./TradingBot');

class ArbitrageBot extends TradingBot {

    constructor(userEmail, platformName, platformInstance, amount, checkOpportunity, tradingPairs, comparePair, checkInterval = 30) {
        super();
        this.userEmail = userEmail;
        this.platformName = platformName;
        this.platformInstance = platformInstance;
        this.amount = amount;
        this.checkOpportunity = checkOpportunity;
        this.tradingPairs = tradingPairs;
        this.comparePair = comparePair;
        this.checkInterval = checkInterval;
    }

    getId() {
        return ArbitrageBot.generateId(this.platformName, this.userEmail, this.tradingPairs, this.comparePair);
    }

    static generateId(platformName, userEmail, tradingPairs, comparePair) {
        return `ARBITRAGE_${platformName}_${userEmail}_TRADING_PAIRS_<${tradingPairs.map(({id}) => id)}>_COMPARE_PAIR_${comparePair}`;
    }

    async run () {
        console.log(`Start arbitrage bot for user ${this.userEmail}, trading pairs ${this.tradingPairs.map(({id}) => id).join(',')} and 
        compare pair ${this.comparePair} on platform ${this.platformName}`);

        while (this.isRunning) {
            const currentOpp = await this.checkOpportunity(this.platformInstance, this.tradingPairs, this.comparePair);

            // We only react to opportunities with at least 1% margin

            // If the opportunity is higher, buy from the simple pair and sell the circular pairs
            if (currentOpp.positiveOpp - 1 > 0.01) {
                console.log('Positive Opportunity found:');
                console.log(currentOpp);

                try {

                    this.tradingPairs.forEach(async ({id}) => {
                        const calcValue = this.amount * (currentOpp.comparePair.ask / currentOpp.currentTickers[id].bid);

                        console.log(`Selling ${calcValue} of coin ${id}`);

                        await this.platformInstance.createOrder(id, 0, calcValue, 'sell', 'market');
                    });

                    console.log(`Buying ${this.amount} of coin ${this.comparePair}`);

                    await this.platformInstance.createOrder(this.comparePair, 0, this.amount, 'buy', 'market');

                } catch (e) {
                    console.log(e);
                    throw e;
                }

                // Opposite opportunity, buy from the circular pairs and sell the simple pair
            } else if (currentOpp.negativeOpp - 1 > 0.01) {
                console.log('Negative Opportunity found:');
                console.log(currentOpp);

                try {
                    this.tradingPairs.forEach(async ({id}) => {
                        const calcValue = this.amount * (currentOpp.comparePair.bid / currentOpp.currentTickers[id].ask);

                        console.log(`Selling ${calcValue} of coin ${id}`);

                        this.platformInstance.createOrder(id, 0, calcValue, 'buy', 'market')
                    });

                    console.log(`Buying ${this.amount} of coin ${this.comparePair}`);

                    this.platformInstance.createOrder(this.comparePair, 0, this.amount, 'sell', 'market')

                } catch (e) {
                    console.log(e);
                    throw e;
                }
            }

            await utils.timeout(1000 * this.checkInterval);
        }
    };
}

module.exports = ArbitrageBot;
