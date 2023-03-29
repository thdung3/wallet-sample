const debug = require('debug')('wallet:server');
const _ = require('lodash');
const camelCaseKeys = require('camelcase-keys');
const express = require('express');
const bodyParser = require('body-parser');
const validators = require('../middlewares/validators')
const utilsHelper = require('../helpers/utils.helper')
const { body } = require("express-validator");
const constants = require('./constants.js')

function getCurrencyToService(services) {
    const hash = {};
    services.forEach((service) => {
        const currencies = service.currencies || [];
        if (service.currency) {
            currencies.push(service.currency);
        }
        currencies.forEach((currency) => {
            hash[currency] = service;
        });
    });
    return hash;
}

async function create({ port, services }) {
    const currencyToService = getCurrencyToService(services);

    const server = express();

    server.use(bodyParser.json());

    const handleRequest = (req, res) => {
        const { url } = req;
        const option = { deep: true };
        const method = _.camelCase(url.slice(1));
        const { service } = req.body;

        const serviceFromCurrency = currencyToService[service];
        if (!serviceFromCurrency) {
            return utilsHelper.sendResponseError(res, 500, 500, 'Currency is not support')
        }
        try {
            // Convert from snake to camel...
            serviceFromCurrency[method](camelCaseKeys(req.body, option))
                .then((response) => {
                    return utilsHelper.sendResponseSuccess(res, 200, response)
                })
                .catch((err) => {
                    debug(err.stack);
                    return utilsHelper.sendResponseError(res, 500, 500, err.message)
                });
        } catch (err) {
            return utilsHelper.sendResponseError(res, 500, 500, 'Undefined method')
        }
    }

    server.post('/add_wallet',
        validators.validateParams([
            body("service", constants.MISSING_SERVICE).exists()
        ]),
        handleRequest);

    server.post('/validate_address',
        validators.validateParams([
            body("service", constants.MISSING_SERVICE).exists(),
            body("address", constants.MISSING_ADDRESS).exists().notEmpty()
        ]),
        handleRequest);

    server.post('/get_balance',
        validators.validateParams([
            body("service", constants.MISSING_SERVICE).exists(),
            body("currency", constants.MISSING_CURRENCY).exists().notEmpty(),
            body("address", constants.MISSING_ADDRESS).exists().notEmpty(),
        ]),
        handleRequest);

    server.post('/get_balance_wallet',
        validators.validateParams([
            body("service", constants.MISSING_SERVICE).exists(),
            body("currency", constants.MISSING_CURRENCY).exists().notEmpty(),
        ]),
        handleRequest);

    server.post('/get_address',
        validators.validateParams([
            body("service", constants.MISSING_SERVICE).exists(),
            body("path", constants.MISSING_PATH).exists().notEmpty()
        ]),
        handleRequest);

    server.post('/add_contract_token',
        validators.validateParams([
            body("service", constants.MISSING_SERVICE).exists(),
            body("currency", constants.MISSING_CURRENCY).exists().notEmpty(),
            body("contractAddress", constants.MISSING_CONTRACT_ADDRESS).exists().notEmpty()
        ]),
        handleRequest);

    server.post('/withdraw',
        // validators.validateIp(),
        validators.validateParams([
            body("service", constants.MISSING_SERVICE).exists(),
            body("type", constants.MISSING_TYPE).exists().notEmpty(),
            body("type", constants.WITHDRAWAL_NOT_SUPPORT_THIS_TYPE).isIn(['withdrawal', 'move_fund']),
            body("currency", constants.MISSING_CURRENCY).exists().notEmpty(),
            body("transactions", constants.MISSING_TRANSACTIONS).exists().notEmpty()
        ]),
        handleRequest);

    const app = server.listen(port, () => {
        debug(`listen on port ${port}`);
    });
    return app;
}

module.exports = { create };
