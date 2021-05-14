const utils = require('./utils');

class tradingBot {

    constructor(getRecentTrades, getLast10RelevantTrades, fetchOrder, fetchTicker, createOrder, editOrder, supportedCoins) {
        this.getRecentTrades = getRecentTrades;
        this.getLast10RelevantTrades = getLast10RelevantTrades;
        this.fetchOrder = fetchOrder;
        this.fetchTicker = fetchTicker;
        this.createOrder = createOrder;
        this.editOrder = editOrder;
        this.supportedCoins = supportedCoins;
        this.isRunning = true;
    }

    async polling() {
        const coinIds = Object.keys(supportedCoins);

        this.checkOpenOrders();

        await utils.timeout(5 * 1000);

        this.checkMarketForNewDips(coinIds);
    }

    stop () {
        this.isRunning = false;
    }

    async getLast10RelevantTrades(coinId) {
        const trades = await this.getRecentTrades(coinId);

        const relevantTrades = trades.filter(trade => trade.amount >= 100);

        // Splice changes the array, so the "leftover" entries are any trades apart from the last 10
        return relevantTrades.splice(relevantTrades.length - 10, relevantTrades.length);
    };

    async getLast10RevelantTradesAveragePrice(coinId) {
        const resp = await this.getLast10RelevantTrades(coinId);

        return resp.map(trade => trade.price).reduce((sum, val) => sum + val, 0) / resp.length;
    };

    async checkOpenOrders() {
        let order, fetchedOrder;

        while (this.isRunning) {
            await utils.timeout(10 * 1000);

            for (let i = 0; i < openOrders.length; i++) {
                order = openOrders[i];

                const {userId, coinId, price, orderId, amount} = order;

                try {
                    fetchedOrder = await this.fetchOrder(userId, orderId);
                } catch (e) {
                    console.log(`fetching order ${orderId} failed with the following error ${e.message}, skipping sell logic for now`);
                    continue;
                }

                if (fetchedOrder.info.OrderState === 'FullyExecuted') {

                    // Last order was sell order, clear the order array to allow for new buy orders
                    if (order.type === 'sell') {
                        openOrders.splice(i, 1);

                        // Reset index after we removed an array entry
                        i--;
                    } else {
                        // Last order was buy order, add subsequent sell oder

                        console.log(`Buy order for user ${userId} and coinId ${coinId} was fully executed, add limit stop oder`);

                        try {
                            const currentTicker = await this.fetchTicker(coinId);

                            const sellPrice = Math.max(price * 1.007, currentTicker.ask - 0.001);

                            // Add sell order 0.5% above the price where we bought it
                            const sellOrder = await this.createOrder(userId, coinId, sellPrice, amount, 'sell', 'limit');

                            // Remove old entry with new one
                            openOrders[i] = {
                                userId: userId,
                                coinId: coinId,
                                amount: amount,
                                orderId: sellOrder.id,
                                price: sellPrice,
                                type: 'sell'
                            };

                        } catch (e) {
                            console.log(`Creating Sell order for user ${userId} and coinId ${coinId} failed, skipping logic for now`);
                        }
                    }


                } else {
                    // Order wasn't fully processed yet, check if order shall be changed to unblock the bot

                    if (order.type === 'sell') {
                        // Check if sell order was placed more than 1 minute ago
                        if (Date.now() - fetchedOrder.timestamp >= 1000 * 60 * 2) {
                            // if so cut your losses, and change the sell price

                            try {
                                console.log(`Unprocessed sell order for user ${userId} and coin ${coinId} is blocking the execution, adjust sell price to unblock bot`);

                                const last10TradesAveragePrice = await getLast10RevelantTradesAveragePrice(coinId);

                                const currentTicker = await this.fetchTicker(coinId);

                                const sellPrice = Math.max(last10TradesAveragePrice * 1.005, currentTicker.ask - 0.001);

                                const newOrder = await this.editOrder(userId, coinId, orderId, sellPrice, Math.max(fetchedOrder.remaining, 10), 'sell', 'limit');

                                // Update order object to new id:
                                order.orderId = newOrder.id;
                            } catch (e) {
                                console.log(`Fetching the recent trades failed for coin ${coinId} with the following error msg: ${e.message}`);
                            }
                        }
                    } else {
                        // Buy order is currently being executed
                        // Check if buy order was placed more than 1 minute ago
                        if (Date.now() - fetchedOrder.timestamp >= 1000 * 60) {
                            // if so change the buy price to unlock the bot
                            try {
                                console.log(`Unprocessed buy order for user ${userId} and coin ${coinId} is blocking the execution, adjust buy price to unblock bot`);

                                const last10TradesAveragePrice = await getLast10RevelantTradesAveragePrice(coinId);

                                const currentTicker = await this.fetchTicker(coinId);

                                const buyPrice = Math.min(currentTicker.bid + 0.0001, last10TradesAveragePrice * 0.994);

                                const newOrder = await this.editOrder(userId, coinId, orderId, buyPrice, Math.max(fetchedOrder.remaining, 10), 'buy', 'limit');

                                order.orderId = newOrder.id;
                                order.price = buyPrice;

                            } catch (e) {
                                console.log(`Adjust buy order failed with the following error msg: ${e.message}`);
                            }
                        }

                    }
                }

            }
        }
    }


    async checkMarketForNewDips(coinIds) {
        while (this.isRunning) {
            const trackedCoins = coinIds.filter(
                coinId => Object.values(isTracking[coinId]).some(obj => obj.tracking));

            // The overall strategy is to look for an overall negative trend, with the last 10 trades having a positive
            // trend "buying the dip"

            let coinId;

            for (let i = 0; i < trackedCoins.length; i++) {
                coinId = trackedCoins[i];

                let trades;
                try {
                    trades = await this.getRecentTrades(coinId);
                } catch (e) {
                    console.log(`Fetching recent trades for ${coinId} failed, skipping logic for now`);
                    continue;
                }

                // Filter out any trades with less than 100 coins, as they are minor

                const relevantTrades = trades.filter(trade => trade.amount >= 40);

                // Splice changes the array, so the "leftover" entries are any trades apart from the last 10
                const last10Trades = relevantTrades.slice(relevantTrades.length - 10, relevantTrades.length);

                if (last10Trades.length !== 10) {
                    continue;
                }

                const last10TradesAveragePrice = last10Trades.map(trade => trade.price).reduce((sum, val) => sum + val, 0) / 10;

                const averages = [];

                const currentTimeInMs = Date.now();

                const offsetInMins = 5;

                const offsetInMs = 1000 * 60 * offsetInMins;

                const tradesMadeWithinTheLast5Mins = relevantTrades.filter(trade => trade.timestamp >= currentTimeInMs - offsetInMs);

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
                    console.log('Very little trading activity going on at the moment, skipping buying order until there is more activity');
                    continue;
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
                        continue;
                    }
                }

                let subGroup, groupAverage;

                for (let i = 0; i < relevantTrades.length; i += 10) {
                    // Put trades into chunk of 10 and build an average

                    subGroup = relevantTrades.splice(0, 10);

                    groupAverage = subGroup.map(trade => trade.price).reduce((sum, val) => sum + val, 0) / subGroup.length;

                    averages.push(groupAverage);
                }

                // Check that averages are going down, allow 1 exception and make sure it overall went down more than 0.5%
                /*
                for (let i = 1; i < averages.length; i++) {
                    if (averages[i] >= averages[i - 1]) {
                        numberOfPositiveTrends++;
                    }
                }
                 */

                //if (averages[0] / last10TradesAveragePrice >= 1.01) {
                for (const [userId, meta] of Object.entries(isTracking[coinId])) {
                    if (openOrders.some(order => order.userId === userId && order.coinId === coinId)) {
                        continue;
                    }

                    const currentTicker = await this.fetchTicker(coinId);

                    if (meta.tracking) {
                        console.log(`Making buy order for user ${userId} and coin ${coinId}`);

                        try {
                            // Use either the current lower ask or the rolling average - 0.5%
                            const buyPrice = Math.min(currentTicker.bid + 0.001, last10TradesAveragePrice * 0.994);

                            const order = await this.createOrder(userId, coinId, buyPrice, meta.amount, 'buy', 'limit');

                            openOrders.push({
                                userId: userId,
                                coinId: coinId,
                                amount: meta.amount,
                                orderId: order.id,
                                price: buyPrice,
                                type: 'buy'
                            });
                        } catch (e) {
                            console.log(`Creating buy order for user ${userId} and coinId ${coinId} failed with the following error msg: ${e.message}, skipping logic for now`);
                        }
                    }

                }
            }

            await utils.timeout(10 * 1000);
        }
    }
}
