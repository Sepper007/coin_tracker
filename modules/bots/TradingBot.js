const {v4: uuid} = require('uuid');

class TradingBot {
    constructor() {
        this.isRunning = true;
        this.softShutdown = false;
        this.uuid = uuid();
    }

    stop(softShutdown) {
        this.isRunning = false;
        this.softShutdown = softShutdown || false;
    }

    getId() {
        throw new Error('The get Id method has to be overridden by the specific trading bot implementation!');
    }
}

module.exports = TradingBot;
