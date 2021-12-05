const utils = require('./utils');


const supportedFrequencyUnits = new Set(['hour', 'day', 'minute']);

class savingsPlan {

    constructor(pool) {
        this.pool = pool;
        this.cache = {};
    }

    async init() {
        try {
            const client = await this.pool.connect();

            const savingsPlanResults = await client.query('select id, user_id, trading_pair, amount, platform_name, frequency_unit, frequency_value from savings_plans');

            savingsPlanResults.rows.forEach(row => {
                const obj = {
                    id: row.id,
                    tradingPair: row.trading_pair,
                    amount: row.amount,
                    platformName: row.platform_name,
                    frequencyUnit: row.frequency_unit,
                    frequencyValue: row.frequency_value
                };

                if (!this.cache[row.user_id]) {
                    this.cache[row.user_id] = {
                        config: [obj],
                        instances: {}
                    };
                } else {
                    this.cache[row.user_id].config.push(obj);
                }
            });

            const relevantUserIds = Object.keys(this.cache);

            const queryStr = 'select user_id, platform, platform_user_id, private_key, public_key, input_vector ' +
                'from account_mappings where user_id = ANY($1)';

            const accountMappingsResults = await client.query(queryStr, [relevantUserIds]);

            const mappedAccounts = accountMappingsResults.rows.reduce((obj, row) => {
                const userId = row.user_id;

                const mappedEntry = {
                    platformUserId: row.platform_user_id,
                    publicKey: row.public_key,
                    privateKey: utils.decryptPrivateKey(row.private_key, row.input_vector)
                };

                if (!obj[userId]) {
                    obj[userId] = {[row.platform]: mappedEntry}
                } else {
                    obj[userId][row.platform] = mappedEntry
                }

                return obj;
            }, {});

            // Init the platform instances for all users that have a valid config present
            relevantUserIds.forEach(userId => {
                const distinctPlatformNames = new Set(this.cache[userId].config.map(({platformName}) => platformName));

                distinctPlatformNames.forEach(platformName => {
                    const platformConfig = mappedAccounts[userId][platformName];

                    this.cache[userId].instances[platformName] = utils.createPlatformInstance(platformName, platformConfig.platformUserId, platformConfig.publicKey, platformConfig.privateKey);
                });
            });

            console.log('The savings plan module was initialised successfully, triggering the task runner now');

            this.taskRunner();
        } catch (e) {
            console.log(`ERROR WHILE INITIALISING THE SAVINGS PLANS MODULE: ${e.message}`);
            console.log(e);
        }
    }


    async taskRunner() {
        while (true) {

            // Wake up for every half-hour, to check if there are any recurring trades that shall be triggered
            const date = new Date();

            const seconds = date.getSeconds();
            const minutes = date.getMinutes();

            const remainingMinutes = 30 - minutes % 30 - (seconds > 0 ? 1 : 0);
            // Add 1 second manually to make sure there are no edge cases with the date validation logic after thread woke up
            const remainingSeconds = 60 - seconds + 1;

            const sleepTimer = (remainingMinutes * 60 + remainingSeconds) * 1000;

            await utils.timeout(sleepTimer);

            console.log('Saving Plan module Woke up to perform recurring buyings');

            const relevantUsers = Object.keys(this.cache);

            const currentDate = new Date();

            relevantUsers.forEach(user => {
                this.cache[user].config.forEach(async (config) => {
                    try {

                        await this.cache[user].instances[config.platformName].createOrder(config.tradingPair, 0, config.amount, 'buy', 'market');

                        // Hourly recurring buys are made at the full hour, daily trades at noon etc.

                        if (!supportedFrequencyUnits.has(config.frequencyUnit)) {
                            console.log(`config for user ${user} has invalid value '${config.frequencyUnit}' for frequencyUnit`);
                            return;
                        }

                        if (config.frequencyUnit === 'day') {
                            if (currentDate.getHours() !== 12 && currentDate.getMinutes() !== 0) {
                                return;
                            }
                            if (currentDate.getDate() % config.frequencyValue !== 0) {
                                return;
                            }
                        }

                        if (config.frequencyUnit === 'hour') {
                            if (currentDate.getMinutes() !== 0) {
                                return;
                            }
                            if (currentDate.getHours() % config.frequencyValue !== 0) {
                                return;
                            }
                        }

                        if (config.frequencyUnit === 'minute') {
                            if (config.frequencyValue !== 30) {
                                console.log(`config for user ${user} has invalid value '${config.frequencyValue}' for frequencyUnit, while using frequencyUnit 'minute', only 30 is allowed for now.`);
                                return;
                            }

                            // this logic is obsolete for now, as '30' is currently the only supported value but is still as fallback if that changes later on
                            if (currentDate.getMinutes() % config.frequencyValue !== 0) {
                                return;
                            }
                        }

                        await this.cache[user].instances[config.platformName].createOrder(config.tradingPair, 0, config.amount, 'buy', 'market');
                    } catch (e) {
                        console.log(`Failed to make recurring order for user ${user}, coin ${config.tradingPair} and platform ${config.platformName}, error: ${e.message}`);
                    }
                });
            });
        }
    }


    getExistingPlans(userId) {
        const entries = this.cache[userId];

        return entries.config.map(({tradingPair, amount, platformName, frequencyUnit, frequencyValue}) => ({
            tradingPair, amount, platformName, frequencyUnit, frequencyValue
        }));
    }

    createPlan(userId, platformName, tradingPair, amount, frequencyUnit = 'hour', frequencyValue = 24) {

    }

    updatePlan(userId, planId, platformName, tradingPair, amount, frequencyUnit = 'hour', frequencyValue = 24) {

    }

    deletePlan(userId, planId) {

    }
}

module.exports = savingsPlan;
