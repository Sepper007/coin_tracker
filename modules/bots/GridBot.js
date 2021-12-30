const utils = require('../utils');
const TradingBot = require('./TradingBot');
const PubSub = require('pubsub-js');
const TradingBotActivityLog = require('./TradingBotActivityLog');

const initArrayOfSizeN = (n) => [...Array(n).keys()].map( i => i+1);

class GridBot extends TradingBot {

    constructor(userEmail, userId, platformName, coinId, maximumInvestment, fetchTicker, createOrder, getMinimumQuantity, numberOfGrids = 5,
                percentagePerGrid = 0.4, startingPrice, strategy = 'neutral') {
        super();
        this.userEmail = userEmail;
        this.userId = userId;
        this.platformName = platformName;
        this.coinId = coinId;
        this.maximumInvestment = maximumInvestment;
        this.fetchTicker = fetchTicker;
        this.createOrder = createOrder;
        this.getMinimumQuantity = getMinimumQuantity;

        this.numberOfGrids = numberOfGrids;
        this.percentagePerGrid = percentagePerGrid;

        this.initStartingPrice(startingPrice, coinId);

        // if the investment strategy is neutral, then we'll start at 0, so we allow the bot to spend the current funds of the user.
        // If the strategy is long, then any amount that is used for sell orders has to be bought at first
        // If the strategy is short, any amount that is used for buy orders has to be realised by sell orders before

        this.currentlyInvestedFunds = strategy === 'neutral' ? maximumInvestment / 2 :
            strategy === 'long' ? 0 : maximumInvestment;

        this.lastExecutedGrid = 0;
    }

    async initStartingPrice(startingPrice, coinId) {
        if (startingPrice) {
            this.startingPrice = startingPrice
        } else {
            // If no starting price was provided, use the current market price as starting price
            this.startingPrice = (await this.fetchTicker(coinId)).last;
        }
        this.initGrids();
    }

    initGrids() {
        const unit = this.startingPrice * (this.percentagePerGrid / 100);

        this.sellGrid = initArrayOfSizeN(this.numberOfGrids).map(val => ({
            hit: false,
            value: this.startingPrice + unit * val
        }));
        this.buyGrid = initArrayOfSizeN(this.numberOfGrids).map(val => ({
            hit: false,
            value: this.startingPrice - unit * val
        }));

        console.log(`The levels of the buy grid for grid bot ${this.getId()} are 
        [${this.buyGrid.map(({value}) => value)}]
        and the sell grids 
        [${this.sellGrid.map(({value}) => value)}]`);
    }

    getId() {
        return GridBot.generateId(this.platformName, this.userEmail, this.coinId);
    }

    static generateId(platformName, userEmail, coinId) {
        return `GRID_${platformName}_${userEmail}_${coinId}`;
    }

    async checkMarket() {
        let last;

        try {
            last = (await this.fetchTicker(this.coinId)).last;
        } catch (e) {
            console.log(`Failed to get the latest ticker information: ${e.message}`);
            return;
        }

        // Check if the the current market price has moved by a grid since our last transaction
        const percentageDiff = last / this.startingPrice - 1;

        // Use abs here, to make sure the Math.floor function is working as expected
        const multiplier = percentageDiff < 0 ? -1 : 1;

        const absoluteVale = Math.abs(percentageDiff);

        const currentGrid = multiplier * Math.floor(absoluteVale / (this.percentagePerGrid / 100));

        if (currentGrid !== this.lastExecutedGrid) {
            await this.executeGridOrder(currentGrid);
        }
    }

    async executeGridOrder(level) {
        if (level === 0) {
            this.lastExecutedGrid = 0;
            return;
        }

        const relevantGrid = (level > 0 ? this.sellGrid: this.buyGrid);

        if (!relevantGrid.some(entry => !entry.hit)) {
            console.log(`The grid for bot ${this.getId()} has reached its limit, reset grid to unblock bot execution`);
            this.startingPrice = (await this.fetchTicker(this.coinId)).last;
            this.initGrids();
        }

        let relevantLevel = level;

        if (Math.abs(relevantLevel) > this.numberOfGrids) {
            if(relevantGrid.some(entry => !entry.hit)) {
                // The current level is out of bound, but there is at least 1 level that was skipped. Manually set the current level to the highest level
                const filteredKeys = [...relevantGrid.keys()].filter(key => !relevantGrid[key].hit);

                relevantLevel = Math.max(...filteredKeys.map(key => Number.parseInt(key)));
            }
        }

        if (relevantGrid[Math.abs(relevantLevel) - 1].hit) {
            // The level was hit recently, skip buying / selling cycle.
            return;
        }

        const orderType = relevantLevel > 0 ? 'sell' : 'buy';

        // Check if we have skipped a level as there was a sudden rise or fall and if so, double the amount of crypto to be bought/sold.
        let levelSkipped =  0;

        if (Math.abs(relevantLevel) > 1) {
            levelSkipped = [...relevantGrid.keys()].filter(key => key < Math.abs(relevantLevel) - 1)
                .map(key => relevantGrid[key])
                .filter(level => !level.hit)
                .length;
        }

        if (this.currentlyInvestedFunds === this.maximumInvestment && orderType === 'buy') {
            console.log(`The GridBot has reached the maximum investment amount, pausing further buys until funds were sold`);
            return;
        }

        let amount = this.maximumInvestment / this.numberOfGrids;

        if (levelSkipped) {
            amount += (amount * levelSkipped);
        }

        if (this.currentlyInvestedFunds < amount && orderType === 'sell') {
            console.log(`The GridBot has reached the the 0 investment amount, pausing further sells until funds were bought`);
            return;
        }

        try {
            console.log(`creating order for level ${relevantLevel} with amount ${amount}`);
            await this.createOrder(this.coinId, undefined, amount, orderType, 'market');

            // After the order went thru successfully, publish a message that'll be picked up by the transaction log module
            const logObject = {
                uuid: this.uuid,
                transactionType: orderType,
                transactionAmount: amount,
                transactionPair: this.coinId,
                additionalInfo: {
                    level: relevantLevel
                }
            };

            PubSub.publish(TradingBotActivityLog.TRANSACTION_LOG_TOPIC_IDENTIFIER, logObject);
        } catch (e) {
            console.log(`Error within grid bot ${this.getId()}:Creating buy order for user ${this.userEmail}, platform ${this.platformName} 
            and coinId ${this.coinId} failed with the following error msg: ${e.message}, skipping logic for now`);
            return;
        }

        this.currentlyInvestedFunds += amount;
        this.lastExecutedGrid = relevantLevel;

        relevantGrid[Math.abs(relevantLevel) - 1].hit = true;

        // After this level was successfully hit and the order went thru successfully, unblock the corresponding level on the opposing side of the grid
        // E.g. the buying level -2 unblocks the sell level +2. This way, we get more frequent trades while making sure no side (buy/sell) is gaining
        // the upper hand
        const opposingGrid = (level > 0 ? this.buyGrid: this.sellGrid);

        opposingGrid[Math.abs(relevantLevel) - 1].hit = false;

        if (levelSkipped) {
            // Set the hit value to true for any entries that come before the current relevantLevel
            for(let i = 1; i < relevantLevel; i++) {
                relevantGrid[i].hit = true;
                opposingGrid[i].hit = false;
            }
        }
    }

    async run() {
        console.log(`Start grid bot for user ${this.userEmail}, trading pair ${this.coinId} on platform ${this.platformName}`);

        while (this.isRunning) {
            await utils.timeout(10 * 1000);

            // If buy/sell grids were not initialized yet, skip logic and wait for the next iteration
            if (this.buyGrid && this.sellGrid) {
                await this.checkMarket();
            }
        }

        // Bot is having a soft shutdown, wait until open sell orders are finished, then shut down
        // TODO: Add soft shutdown logic, where funds are evened out.
    }
}

module.exports = GridBot;
