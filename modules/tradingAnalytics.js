const tradingAnalytics = {
    aggregateMyTrades: (coinId, minutesUp, trades, ticker) => {
        try {
            let sellsAccumulated = {
                [coinId]: 0,
                cad: 0
            };

            let buysAccumulated = {
                [coinId]: 0,
                cad: 0
            };

            let fees = {
                [coinId]: 0,
                cad: 0
            };

            trades.forEach(trade => {
                if (trade.side === 'buy') {
                    buysAccumulated.cad += trade.cost;
                    buysAccumulated[coinId] += trade.amount;
                } else {
                    sellsAccumulated.cad += trade.cost;
                    sellsAccumulated[coinId] += trade.amount;
                }

                if (trade.fee.currency === 'CAD') {
                    fees.cad += trade.fee.cost;
                } else {
                    fees[coinId] += trade.fee.cost;
                }
            });

            const higherCoinAmount = Math.max(buysAccumulated[coinId], sellsAccumulated[coinId]);

            const buysAvg = buysAccumulated.cad / buysAccumulated[coinId];

            const sellsAvg = sellsAccumulated.cad / sellsAccumulated[coinId];

            const outstandingSellAmount = buysAccumulated[coinId] - sellsAccumulated[coinId];

            const currentCoinPrice = ticker.last;

            const historicFees = {
                buy: fees[coinId] / sellsAccumulated[coinId],
                sell: fees.cad / buysAccumulated.cad
            };

            const outstandingFees = {
                // Check for outstanding buys, as they are charging fees in the crypto target currency
                coin: outstandingSellAmount < 0 ? Math.abs(outstandingSellAmount) * historicFees.buy : 0,
                cad: outstandingSellAmount > 0 ? outstandingSellAmount * currentCoinPrice * historicFees.sell : 0
            };

            const weightedAvg = {
                // Check for outstanding sells, as they are charging fees in the fiat currency
                cad: higherCoinAmount * (sellsAvg - buysAvg) - outstandingFees.cad - outstandingFees.coin * currentCoinPrice
            };

            const absolutePL = {
                [coinId]: buysAccumulated[coinId] - sellsAccumulated[coinId] - fees[coinId],
                cad: sellsAccumulated.cad - buysAccumulated.cad - fees.cad
            };

            const relativePL = absolutePL.cad + absolutePL[coinId] * currentCoinPrice;

            return {
                minutesUp: minutesUp,
                    // sinceTrackingStart ? (Date.now() - isTracking[coinId][userId].since) / (1000 * 60) : null,
                currentPrice: currentCoinPrice,
                buys: {
                    [coinId]: buysAccumulated[coinId],
                    cad: buysAccumulated.cad,
                    avgPrice: buysAvg
                },
                sells: {
                    [coinId]: sellsAccumulated[coinId],
                    cad: sellsAccumulated.cad,
                    avgPrice: sellsAvg
                },
                fees: fees,
                profitAndLoss: {
                    [coinId]: absolutePL[coinId],
                    cad: absolutePL.cad,
                    relativePL: `${relativePL} CAD`
                }
            };

        } catch (e) {
            console.log(e.message);
        }
    }
};

module.exports = tradingAnalytics;
