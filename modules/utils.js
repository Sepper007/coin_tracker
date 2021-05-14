const utils = {
    timeout: (ms) => new Promise(resolve => setTimeout(resolve, ms))
};

module.exports = utils;
