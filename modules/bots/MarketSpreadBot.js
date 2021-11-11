const utils = require('../utils');
const TradingBot = require('./TradingBot');

class MarketSpreadBot extends TradingBot {

    constructor(userEmail, platformName, coinId, amount, getRecentTrades, fetchTicker, fetchOrder, createOrder, editOrder, getMinimumQuantity) {
        super();
        this.userEmail = userEmail;
        this.platformName = platformName;
        this.coinId = coinId;
        this.amount = amount;
        this.getRecentTrades = getRecentTrades;
        this.fetchTicker = fetchTicker;
        this.fetchOrder = fetchOrder;
        this.createOrder = createOrder;
        this.editOrder = editOrder;
        this.getMinimumQuantity = getMinimumQuantity;

        this.openOrder = null;
        this.remoteOrder = null;

        this.run();
    }

    getId() {
        return MarketSpreadBot.generateId(this.platformName, this.userEmail, this.coinId);
    }

    static generateId(platformName, userEmail, coinId) {
        return `MARKET_SPREAD_${platformName}_${userEmail}_${coinId}`;
    }

    async run() {
        while (this.isRunning) {
            await utils.timeout(1 * 1000);

            // Periodically wake up and either make a new buy order or check if existing order went through or has to be updated
            if (!this.openOrder) {
                await this.checkMarketForBuyingOrder();
            } else {
                const {orderId} = this.openOrder;

                try {
                    this.remoteOrder = await this.fetchOrder(orderId, this.coinId);
                } catch (e) {
                    console.log(`fetching order ${orderId} for user ${this.userEmail} on platform ${this.platformName} failed with the following error ${e.message}, skipping sell logic for now`);
                    continue;
                }

                // Different platforms use different response structure
                if (this.remoteOrder.info.OrderState === 'FullyExecuted' || this.remoteOrder.info.status === 'FILLED') {
                    await this.reactToExecutedOrder();
                } else {
                    await this.adjustOpenOrder();
                }
            }
        }

        // Bot is having a soft shutdown, wait until open sell orders are finished, then shut down
        if (this.softShutdown && this.openOrder && this.openOrder.type === 'sell') {
            while(this.openOrder) {
                // As long as there is an open sell order, keep on adjusting the price to make sure it gets filled
                await this.adjustOpenOrder();

                await utils.timeout(10 * 1000);
            }
        }
    }

    async getLast10RelevantTrades(coinId, ticker) {
        const trades = await this.getRecentTrades(coinId);

        // Only consider transactions with value > $50, as everything else is minor
        const threshold = (50 / ticker.bid);

        const relevantTrades = trades.filter(trade => trade.amount >= threshold);

        // Splice changes the array, so the "leftover" entries are any trades apart from the last 10
        return relevantTrades.splice(relevantTrades.length - 10, 10);
    }

    async getLast10RelevantTradesAveragePrice(coinId, ticker) {
        const resp = await this.getLast10RelevantTrades(coinId, ticker);

        return resp.map(trade => trade.price).reduce((sum, val) => sum + val, 0) / resp.length;
    }

    async reactToExecutedOrder() {
        // The executed order was a sell order, clear the order object to allow for new buy orders
        if (this.openOrder.type === 'sell') {
            this.openOrder = null;
        } else {
            const {coinId, amount} = this.openOrder;

            // Last order was buy order, add subsequent sell oder
            console.log(`Buy order for user ${this.userEmail}, platform ${this.platformName} and coinId "${coinId}" was fully executed, add limit stop oder`);

            try {
                const currentTicker = await this.fetchTicker(coinId);

                const last10TradesAveragePrice = await this.getLast10RelevantTradesAveragePrice(this.coinId, currentTicker);

                const sellPrice = Math.max(last10TradesAveragePrice * 1.005, currentTicker.ask - 0.001);

                // Add sell order 0.5% above the price where we bought it
                const sellOrder = await this.createOrder(coinId, sellPrice, amount, 'sell', 'limit');

                // Replace old entry with new one
                this.openOrder = {
                    coinId: coinId,
                    amount: amount,
                    orderId: sellOrder.id,
                    price: sellPrice,
                    type: 'sell'
                };

            } catch (e) {
                console.log(`Creating Sell order for user ${this.userEmail}, platform ${this.platformName} and coinId ${coinId} failed, skipping logic for now`);
            }
        }
    }

    async adjustOpenOrder() {
        // Order wasn't fully processed yet, check if order shall be changed to unblock the bot
        if (this.openOrder.type === 'sell') {
            // Check if sell order was placed more than 30 seconds
            if (Date.now() - this.remoteOrder.timestamp >= 1000 * 60) {
                // if so cut your losses, and change the sell price

                try {
                    console.log(`Unprocessed sell order for user ${this.userEmail}, platform ${this.platformName} and coin ${this.coinId} is blocking the execution, adjust sell price to unblock bot`);

                    const currentTicker = await this.fetchTicker(this.coinId);

                    const last10TradesAveragePrice = await this.getLast10RelevantTradesAveragePrice(this.coinId, currentTicker);

                    const sellPrice = Math.max(last10TradesAveragePrice * 1.005, currentTicker.ask - 0.001);

                    const amount = Math.max(this.remoteOrder.remaining, this.getMinimumQuantity(this.coinId));

                    const newOrder = await this.editOrder(this.coinId, this.openOrder.orderId, sellPrice, amount, 'sell', 'limit');

                    this.openOrder = {
                        ...this.openOrder,
                        orderId: newOrder.id,
                        price: sellPrice
                    };

                    // Update order object to new id:
                    this.openOrder.orderId = newOrder.id;
                } catch (e) {
                    console.log(`Fetching the recent trades failed for coin ${this.coinId} with the following error msg: ${e.message}`);
                }
            }
        } else {
            // Buy order is currently being executed
            // Check if buy order was placed more than 30 seconds ago
            if (Date.now() - this.remoteOrder.timestamp >= 1000 * 60) {
                // if so change the buy price to unlock the bot
                try {
                    console.log(`Unprocessed buy order for user ${this.userEmail}, platform ${this.platformName} and coin ${this.coinId} is blocking the execution, adjust buy price to unblock bot`);

                    const currentTicker = await this.fetchTicker(this.coinId);

                    const last10TradesAveragePrice = await this.getLast10RelevantTradesAveragePrice(this.coinId, currentTicker);

                    const buyPrice = Math.min(currentTicker.bid + 0.0001, last10TradesAveragePrice * 0.995);

                    const amount = Math.max(this.remoteOrder.remaining, this.getMinimumQuantity(this.coinId));

                    const newOrder = await this.editOrder(this.coinId, this.openOrder.orderId, buyPrice, amount, 'buy', 'limit');

                    this.openOrder = {
                        ...this.openOrder,
                        orderId: newOrder.id,
                        price: buyPrice
                    };
                } catch (e) {
                    console.log(`Adjust buy order failed with the following error msg: ${e.message}`);
                }
            }
        }
    }

    static assessMarketTrends(trades) {
        const currentTimeInMs = Date.now();

        const offsetInMins = 2;

        const offsetInMs = 1000 * 60 * offsetInMins;

        const tradesMadeWithinTheLast5Mins = trades.filter(trade => trade.timestamp >= currentTimeInMs - offsetInMs);

        const groupTradesByMins = [];

        for (let i = 0; i < offsetInMins; i++) {
            groupTradesByMins[i] = [];
        }

        let relevantGroupIndex;

        // Create a group of trades for every minute (< 1-minute ago, > 1-minute and <= 2-minutes ago etc.)
        tradesMadeWithinTheLast5Mins.forEach(trade => {
            relevantGroupIndex = Math.floor((currentTimeInMs - trade.timestamp) / (1000 * 60));

            groupTradesByMins[relevantGroupIndex].push(trade.price);
        });

        // If there's a gap of data remove that group from the array
        const groupAverages = groupTradesByMins.filter(arr => arr.length)
            .map(arr => {
                const aggregatedPrices = arr.reduce((avg, val) => avg + val, 0);

                return aggregatedPrices / arr.length;
            });


        // Only allow 2 gaps max, otherwise the present data isn't significant enough
        if (groupAverages.length < offsetInMins - 1) {
            console.log(`Very little trading activity going on at the moment for coin ${this.coinId} on platform ${this.platformName}, skipping buying order until there is more activity`);
            return false;
        }

        // If general trend is negative skip buying until market has stabilised

        const filteredGroupsLength = groupAverages.length;

        // If recent trend is positive skip further evaluations and proceed to buying logic
        if (groupAverages[filteredGroupsLength - 1] < groupAverages[filteredGroupsLength - 2]) {
            let generalTrendNegative = true;

            for (let i = 0; i < filteredGroupsLength - 2; i++) {
                // Found a positive trend for at least one sequence, skip logic and proceed to buying logic
                if (groupAverages[i] < groupAverages[i + 1]) {
                    generalTrendNegative = false;
                    break;
                }
            }

            if (generalTrendNegative) {
                console.log('The general market trend is negative at the moment, delay creation of new buying orders until market has stabilised');
                return false;
            }
        }

        return true;
    }

    // If this returns false, the current market situation isn't suggesting to add a buy order
    static assessCurrentMarketSituation = (trades, threshold, coinId, platformName) => {
        // Filter out any trades with than the threshold, as they are minor
        const relevantTrades = trades.filter(trade => trade.amount >= threshold);

        // Splice changes the array, so the "leftover" entries are any trades apart from the last 10
        const last10Trades = relevantTrades.slice(relevantTrades.length - 10, relevantTrades.length);

        if (last10Trades.length !== 10) {
            console.log(`Not enough relevant trades present for coin ${coinId} on platform ${platformName}`);
            return false;
        }

        const suggestPlacingBuyOrder = true; // MarketSpreadBot.assessMarketTrends(relevantTrades);

        return {
            suggestPlacingBuyOrder: suggestPlacingBuyOrder,
            // Return the average price of the last 10 transactions, if the general market trends suggests placing a buy order
            average: suggestPlacingBuyOrder ? last10Trades.map(trade => trade.price).reduce((sum, val) => sum + val, 0) / 10 : null
        };
    };

    async checkMarketForBuyingOrder() {
        let trades;

        try {
            trades = await this.getRecentTrades(this.coinId);
        } catch (e) {
            console.log(`Fetching recent trades for ${this.coinId} failed, skipping logic for now`);
            return;
        }

        const currentTicker = await this.fetchTicker(this.coinId);

        // Set threshold any offers with at least $50
        const threshold = (50 / currentTicker.bid);

        const marketAssessment = MarketSpreadBot.assessCurrentMarketSituation(trades, threshold, this.coinId, this.platformName);

        if (marketAssessment.suggestPlacingBuyOrder) {
            console.log(`Creating buy order for user ${this.userEmail}, platform ${this.platformName} and coin ${this.coinId}`);

            try {
                // Use either the current lower ask or the rolling average - 0.06%
                const buyPrice = Math.min(currentTicker.bid + 0.001, marketAssessment.average * 0.995);

                const order = await this.createOrder(this.coinId, buyPrice, this.amount, 'buy', 'limit');

                this.openOrder = {
                    coinId: this.coinId,
                    amount: this.amount,
                    orderId: Number.parseInt(order.id),
                    price: buyPrice,
                    type: 'buy'
                };
            } catch (e) {
                console.log(`Creating buy order for user ${this.userEmail}, platform $e{this.platformName} and coinId ${this.coinId} failed with the following error msg: ${e.message}, skipping logic for now`);
            }
        }
    }

}

module.exports = MarketSpreadBot;
