const graylog2 = require('graylog2')
const logger = new graylog2.graylog({
    servers: [
        { 'host': process.env.GRAYLOG_HOST, port: process.env.GRAYLOG_PORT },
    ],
    bufferSize: 1350
});

const loggerHelper = {}

loggerHelper.log = (message, data) => {
    if (data)
        logger.log(message, { data: data }, { Application: "Wallet", stringLevel: "Information" })
    else
        logger.log(message, { Application: "Wallet", stringLevel: "Information" },)
}

module.exports = loggerHelper