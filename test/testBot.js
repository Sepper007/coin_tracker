const assert = require('assert');

const GridBot = require('../modules/bots/GridBot');

function* tickerGenerator(init, cycles = 10, percentage = 0.002, trend = 'negative') {
    for (let i = 0; i < cycles; i++) {
        yield init + (trend === 'negative' ? -1 : 1) * init * percentage * i;
    }
}

describe('Trading Bt Test', () => {
   it('Should run without errors', async () => {
       const fetchTickerGen = tickerGenerator(0.15, 12, 0.007);

      const gridBot = new GridBot(
           'dummy@gmail.com',
           1234,
           'testPlatform',
           'USDT/DOGE',
           120,
           // Bind all functions to the initial instance of the tradingPlatform, to prevent any issue with the this-context at runtime
          () => {
               const val = fetchTickerGen.next();

               if (val.done) {
                   console.log('Test done');
                   gridBot.stop();
               }

               return {
                   last: val.value
               };
          },
           () => ({
               id: 1
           }),
           () => 10,
           6,
           0.4,
           undefined,
           'allFunds'
       );

      gridBot.run(1);

      await new Promise((done) => setTimeout(() => done(), 1000 * 14));
   }).timeout(15 * 1000);
});
