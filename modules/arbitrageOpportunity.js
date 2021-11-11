const getLastTicker = async (platformInstance, coinId) => {
    const ticker = await platformInstance.fetchTicker(coinId);

    return {
        last: ticker.last,
        bid: ticker.bid,
        ask: ticker.ask
    };
};

const checkOpportunity = async (platformInstance, tradingPairs, comparePair) => {
    const mappedValues = await Promise.all(tradingPairs.map(async (pair) => ({
        values: await getLastTicker(platformInstance, pair.id),
        traversed: pair.traversed
    })));

    const currentTickers = tradingPairs.reduce((obj, entry, index) => {
        obj[entry.id] = mappedValues[index].values;
        return obj;
    }, {});

    const valueComparePair = await getLastTicker(platformInstance, comparePair);

    currentTickers[comparePair] = valueComparePair;

    // There could be either a positive or a negative opportunity, calculate both

    const firstElement = mappedValues.shift();

    const calcBuyPair = mappedValues.reduce((value, element) => value / (element.traversed ? (1 / element.values.ask) : element.values.ask), firstElement.values.ask);

    const calcSellPair = mappedValues.reduce((value, element) => value / (element.traversed ? (1 / element.values.bid) : element.values.bid), firstElement.values.bid);

    // Option 1: we buy thru the circular option and sell thru the basic pair
    const positiveOpp = valueComparePair.bid / calcBuyPair;

    // Option 2: we buy thru the basic pair and sell thru the circular option
    const negativeOpp = calcSellPair / valueComparePair.ask;


    return {
        currentTickers,
        comparePair: valueComparePair,
        positiveOpp,
        negativeOpp
    };
};

module.exports = {checkOpportunity};
