class Utils {
    static formatDate (str) {
        const date = new Date(str);

        const minutes = date.getMinutes();

        return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${minutes < 10 ? '0': ''}${minutes}`;
    }
}

module.exports = Utils;
