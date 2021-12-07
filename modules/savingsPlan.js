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

            const savingsQueryStr = 'select t1.id as id, t1.user_id as user_id, t1.trading_pair as trading_pair, t1.amount as amount, t1.currency as currency, '
                + 't1.frequency_unit as frequency_unit, t1.platform_name as platform_name, t2.description as platform_description, t1.frequency_value as frequency_value from savings_plans as t1 '
                + 'inner join platforms as t2 on t1.platform_name = t2.id';

            const savingsPlanResults = await client.query(savingsQueryStr);

            savingsPlanResults.rows.forEach(row => {
                const obj = {
                    id: row.id,
                    tradingPair: row.trading_pair,
                    amount: row.amount,
                    currency: row.currency,
                    platformName: row.platform_name,
                    platformDescription: row.platform_description,
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

            console.log('Saving Plan module Woke up to perform recurring buyings');

            const relevantUsers = Object.keys(this.cache);

            const currentDate = new Date();

            relevantUsers.forEach(user => {
                this.cache[user].config.forEach(async (config) => {
                    try {
                        // Hourly recurring buys are made at the full hour, daily trades at noon etc.

                        if (!supportedFrequencyUnits.has(config.frequencyUnit)) {
                            console.log(`config for user ${user} has invalid value '${config.frequencyUnit}' for frequencyUnit`);
                            return;
                        }

                        if (config.frequencyUnit === 'day') {
                            if (currentDate.getHours() !== 12 || currentDate.getMinutes() !== 0) {
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

                        // Check if the selected currency is the first or the second part of the trading pair.
                        // If it's the second part, we have to do a conversion using the current market price to determine the amount we want to buy
                        // E.g. currency => CAD, tradingPair => ETH/CAD, amount => 2, Current ETH/CAD Price => 5000, calculated market order amount => 2 / 5000 = 0.0004

                        let orderAmount = config.amount;

                        if (config.tradingPair.split('/').indexOf(config.currency) > 0) {
                            // Get the current market price and use it to calculate the amount for the market order
                            const { ask } = await this.cache[user].instances[config.platformName].fetchTicker(config.tradingPair);

                            orderAmount = config.amount / ask;
                        }

                        await this.cache[user].instances[config.platformName].createOrder(config.tradingPair, 0, orderAmount, 'buy', 'market');
                    } catch (e) {
                        console.log(`Failed to make recurring order for user ${user}, coin ${config.tradingPair} and platform ${config.platformName}, error: ${e.message}`);
                    }
                });
            });


            await utils.timeout(sleepTimer);
        }
    }


    getExistingPlans(userId) {
        const entries = this.cache[userId];

        return entries.config.map(({id, tradingPair, amount, currency, platformName, platformDescription, frequencyUnit, frequencyValue}) => ({
            tradingPair, amount, currency, platformName, platformDescription, frequencyUnit, frequencyValue, id
        }));
    }

    async createPlan (userId, platformName, tradingPair, amount,currency, frequencyUnit = 'hour', frequencyValue = 24) {
        try {
            const client = await this.pool.connect();

            // Open transaction, and if any step along the way fails, rollback insert stmt
            await client.query('BEGIN');

            // Check if given-user has his credentials persisted for the given platform before proceeding
            const configResult = await client.query('select user_id, platform, platform_user_id, private_key, public_key, input_vector ' +
                'from account_mappings where user_id = $1', [userId]);

            if (!configResult.rows.length) {
                throw new Error(`User ${userId} doesn't have credentials persisted for platform ${platformName}`);
            }

            const platformResult = await client.query('select description from platforms where id = $1', [platformName]);

            if (!platformResult.rows.length) {
                throw new Error(`No description was found for platform with id ${platformName}`);
            }

            const platformDescription = platformResult.rows[0].description;

            const persistedConfig = configResult.rows[0];

            const generatedId = (await client.query("select nextval('savings_plans_ids') as id")).rows[0].id;

            const numPlanId = parseInt(generatedId);

            await client.query('Insert into savings_plans  (id, user_id, trading_pair, amount, currency, platform_name, frequency_unit, frequency_value) values ($1,$2,$3,$4,$5,$6,$7,$8)',
                [numPlanId, userId, tradingPair, amount, currency, platformName, frequencyUnit, frequencyValue]);

            const config =  {
                id: numPlanId,
                tradingPair: tradingPair,
                amount: amount,
                currency: currency,
                platformName: platformName,
                platformDescription,
                frequencyUnit: frequencyUnit,
                frequencyValue: frequencyValue
            };

            this.cache[userId].config = [...this.cache[userId].config, config];

            // There is already a cached platform instance for the platform that is to be used for this savingsPlan available, we don't have to do anything
            if (!this.cache[userId].instances[platformName]) {
                // otherwise create the new instance
                const decryptedPrivateKey = utils.decryptPrivateKey(persistedConfig.private_key, persistedConfig.input_vector);

                this.cache[userId].instances[platformName] = utils.createPlatformInstance(platformName, persistedConfig.user_id, persistedConfig.public_key, decryptedPrivateKey);
            }

            await client.query('COMMIT');

            return {id: generatedId};
        } catch (e) {
            console.log('An error occurred while trying to save a new savings plans');
            console.log(e);
            throw e;
        }

    }

    async updatePlan(userId, planId, amount, frequencyUnit = 'hour', frequencyValue = 24) {
        try {
          const client = await this.pool.connect();

          const numPlanId = parseInt(planId);

          await client.query('update savings_plans set amount = $1, frequency_unit = $2, frequency_value = $3 where user_id = $4 and id = $5',
              [amount, frequencyUnit, frequencyValue, userId, numPlanId]);

          const configToBeChanged = this.cache[userId].config.find(config => config.id === numPlanId);

          configToBeChanged.amount = amount;
          configToBeChanged.frequencyUnit = frequencyUnit;
          configToBeChanged.frequencyValue = frequencyValue;
        } catch (e) {
            console.log('An error occurred while trying to update a savings plans');
            console.log(e);
            throw e;
        }
    }

    async deletePlan(userId, planId) {
        try {
            const numPlanId = parseInt(planId);

            const client = await this.pool.connect();

            client.query('delete from savings_plans where id = $1', [numPlanId]);

            this.cache[userId].config = this.cache[userId].config.filter(config => config.id !== numPlanId);

            // Check if this plan that was just removed was the only one for this platform and if so, remove the cached platform object from the cache
            const platformNames = Object.keys(this.cache[userId].instances);

            platformNames.forEach(platformName => {
                if (!(this.cache[userId].config.some(config => config.platformName === platformName))) {
                    delete this.cache[userId].instances[platformName];
                }
            });
        } catch (e) {
            console.log('An error occurred while trying to update a savings plans');
            console.log(e);
            throw e;
        }
    }
}

module.exports = savingsPlan;
