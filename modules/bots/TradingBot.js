class TradingBot {
    constructor() {
        this.isRunning = true;
        this.softShutdown = false;
    }

    stop(softShutdown) {
        this.isRunning = false;
        this.softShutdown = softShutdown || false;
    }
}

module.exports = TradingBot;
