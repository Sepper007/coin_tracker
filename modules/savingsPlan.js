const utils = require('./utils');

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
                    obj[userId] = {[row.platform]:mappedEntry}
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

                    this.cache[userId].instances[platformName] = utils.createPlatformInstance(platformName, userId, platformConfig.publicKey, platformConfig.privateKey);
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
