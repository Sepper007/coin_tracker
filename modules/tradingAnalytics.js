const tradingAnalytics = {
    aggregateMyTrades: (coinId, marketId, minutesUp, trades, ticker) => {
        try {
            const [firstCurr, secondCurr] = marketId.split('/');

            let sellsAccumulated = {
                [firstCurr]: 0,
                [secondCurr]: 0
            };

            let buysAccumulated = {
                [firstCurr]: 0,
                [secondCurr]: 0
            };

            let fees = {
                [firstCurr]: 0,
                [secondCurr]: 0
            };

            trades.forEach(trade => {
                if (trade.side === 'buy') {
                    buysAccumulated[secondCurr] += trade.cost;
                    buysAccumulated[firstCurr] += trade.amount;
                } else {
                    sellsAccumulated[secondCurr] += trade.cost;
                    sellsAccumulated[firstCurr] += trade.amount;
                }

                if (trade.fee.currency === secondCurr) {
                    fees[secondCurr] += trade.fee.cost;
                } else {
                    fees[firstCurr] += trade.fee.cost;
                }
            });

            const higherCoinAmount = Math.max(buysAccumulated[firstCurr], sellsAccumulated[firstCurr]);

            const buysAvg = buysAccumulated[secondCurr] / buysAccumulated[firstCurr];

            const sellsAvg = sellsAccumulated[secondCurr] / sellsAccumulated[firstCurr];

            const outstandingSellAmount = buysAccumulated[firstCurr] - sellsAccumulated[firstCurr];

            const currentCoinPrice = ticker.last;

            const historicFees = {
                buy: fees[firstCurr] / sellsAccumulated[firstCurr],
                sell: fees[secondCurr] / buysAccumulated[secondCurr]
            };

            const outstandingFees = {
                // Check for outstanding buys, as they are charging fees in the crypto target currency
                coin: outstandingSellAmount < 0 ? Math.abs(outstandingSellAmount) * historicFees.buy : 0,
                [secondCurr]: outstandingSellAmount > 0 ? outstandingSellAmount * currentCoinPrice * historicFees.sell : 0
            };

            const weightedAvg = {
                // Check for outstanding sells, as they are charging fees in the fiat currency
                [secondCurr]: higherCoinAmount * (sellsAvg - buysAvg) - outstandingFees[secondCurr] - outstandingFees.coin * currentCoinPrice
            };

            const absolutePL = {
                [firstCurr]: buysAccumulated[firstCurr] - sellsAccumulated[firstCurr] - fees[firstCurr],
                [secondCurr]: sellsAccumulated[secondCurr] - buysAccumulated[secondCurr] - fees[secondCurr]
            };

            const relativePL = absolutePL[secondCurr] + absolutePL[firstCurr] * currentCoinPrice;

            return {
                tradingPair: marketId,
                minutesUp: minutesUp,
                    // sinceTrackingStart ? (Date.now() - isTracking[coinId][userId].since) / (1000 * 60) : null,
                currentPrice: currentCoinPrice,
                buys: {
                    [firstCurr]: buysAccumulated[firstCurr],
                    [secondCurr]: buysAccumulated[secondCurr],
                    avgPrice: buysAvg
                },
                sells: {
                    [firstCurr]: sellsAccumulated[firstCurr],
                    [secondCurr]: sellsAccumulated[secondCurr],
                    avgPrice: sellsAvg
                },
                fees: fees,
                profitAndLoss: {
                    [firstCurr]: absolutePL[firstCurr],
                    [secondCurr]: absolutePL[secondCurr],
                    relativePL: `${relativePL} ${secondCurr}`
                }
            };

        } catch (e) {
            console.log(e.message);
        }
    }
};

module.exports = tradingAnalytics;
