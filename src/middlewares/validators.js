const { validationResult } = require("express-validator");
const utilsHelper = require('../helpers/utils.helper')

const validators = {}

validators.validateParams = (validationArray) => async (req, res, next) => {
    await Promise.all(validationArray.map((validation) => validation.run(req)))
    const errors = validationResult(req)
    if (errors.isEmpty()) return next()
    const extractedErrors = [];
    errors
        .array()
        .map((error) => extractedErrors.push(error.msg));
    return utilsHelper.sendResponseError(res, 400, 400, extractedErrors[0])
}

validators.validateIp = () => async (req, res, next) => {
    let ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    if (ipAddress.substr(0, 7) == "::ffff:") {
        ipAddress = ipAddress.substr(7)
    }
    if (ipAddress !== '222.106.173.212') {
        return utilsHelper.sendResponseError(res, 401, 401, 'access deni from ip ' + ipAddress)
    }
    return next()
}

module.exports = validators

