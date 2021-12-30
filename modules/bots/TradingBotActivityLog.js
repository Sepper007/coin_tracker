const PubSub = require('pubsub-js');

const insertTransactionQuery = 'INSERT INTO bot_transaction_log (uuid, transaction_type, transaction_amount, transaction_pair, additional_info) values ($1,$2,$3,$4,$5)';

const insertBotQuery = 'INSERT INTO bot_log (uuid, user_id, bot_type, additional_info,active) values ($1,$2,$3,$4, 1)';
const updateBotQuery = 'UPDATE bot_log set additional_info = $1 where uuid = $2';
const stopBotQuery = 'UPDATE bot_log set active = 0 where uuid = $1';

class TradingBotActivityLog {

    constructor(pool) {
        this.pool = pool;
    }

    static BOT_CUD_TOPIC_IDENTIFIER = "BOT_CUD";
    static BOT_CUD_EVENT = {
        CREATE: 'CREATE',
        UPDATE: 'UPDATE',
        STOP: 'STOP'
    };

    static TRANSACTION_LOG_TOPIC_IDENTIFIER = 'BOT_TRANSACTION_LOG';

    start () {
        this.transactionToken = PubSub.subscribe(TradingBotActivityLog.TRANSACTION_LOG_TOPIC_IDENTIFIER, this.botTransactionSubscriptionHandler.bind(this));
        this.cudToken = PubSub.subscribe(TradingBotActivityLog.BOT_CUD_TOPIC_IDENTIFIER, this.botCudSubscriptionHandler.bind(this));
        console.log('*** Trading Bot Activity Log module was booted up successfully ***');
    }

    async botCudSubscriptionHandler (topicIdentifier, data) {
        try {
            const subTopic = topicIdentifier.split('.')[1];

            const client = await this.pool.connect();

            switch (subTopic) {
                case TradingBotActivityLog.BOT_CUD_EVENT.UPDATE: {
                    const {
                        uuid,
                        additionalInfo
                    } = data;

                    await client.query(updateBotQuery, [additionalInfo, uuid]);
                    break;
                }
                case TradingBotActivityLog.BOT_CUD_EVENT.STOP: {
                    const { uuid } = data;

                    await client.query(stopBotQuery, [uuid]);
                    break;
                }
                // intentionally use fall-through here, as the create event is the default
                case TradingBotActivityLog.BOT_CUD_EVENT.CREATE:
                default: {
                    const {
                        uuid,
                        userId,
                        botType,
                        additionalInfo
                    } = data;

                    await client.query(insertBotQuery, [uuid, userId, botType, additionalInfo]);
                    break;
                }
            }

        } catch (e) {
            console.log(`An error occurred while trying to process bot cud message: ${e.message}`);
        }
    }

    async botTransactionSubscriptionHandler (topicIdentifier, data) {
        try {
            const {
                uuid,
                transactionType,
                transactionAmount,
                transactionPair,
                additionalInfo
            } = data;

            const client = await this.pool.connect();

            try {
                await client.query(insertTransactionQuery, [uuid, transactionType, transactionAmount, transactionPair, additionalInfo]);
            } catch (e) {
                console.log(`An error occurred, while trying to persist a Bot Transaction Log ${e.message}`);
            }

        } catch (e) {
            console.log(`Failed to log bot transaction: ${e.message}`);
        }
    }

    stop () {
        if (this.transactionToken) {
            PubSub.unsubscribe(this.transactionToken);
        }
        if (this.cudToken) {
            PubSub.unsubscribe(this.cudToken);
        }
        console.log('Bot Transaction log was shut down successfully');
    }
}

module.exports = TradingBotActivityLog;
