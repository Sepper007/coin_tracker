const tradingPlatforms = require('../utils/supportedTradingPlatforms');
const crypto = require('crypto');

const utils = {
    timeout: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    formatDate: (str) => {
        const date = new Date(str);

        const minutes = date.getMinutes();

        return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${minutes < 10 ? '0' : ''}${minutes}`;
    },
    decryptPrivateKey(encryptedKey, input_vector) {
        const secretKey = process.env.ENCRYPTION_KEY;

        const decipher = crypto.createDecipheriv('aes-256-ctr', secretKey, input_vector);

        const decryptedPrivateKey = Buffer.concat([decipher.update(Buffer.from(encryptedKey, 'hex')), decipher.final()]);

        return decryptedPrivateKey.toString();
    },
    createPlatformInstance(platform, userId, publicKey, privateKey) {
        if (!tradingPlatforms[platform]) {
            throw new Error(`Platform ${platform} is not supported, the supported values are: ${Object.keys(tradingPlatforms).join(',')}`);
        }

        return new tradingPlatforms[platform]({
            uid: userId,
            apiKey: publicKey,
            secret: privateKey
        });
    }
};

module.exports = utils;
