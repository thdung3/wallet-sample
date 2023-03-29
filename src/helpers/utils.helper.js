const utilsHelper = {}

utilsHelper.sendResponseError = (res, status, code, message) => {
    return res.status(status).json({ success: false, error: { code, message } })
}

utilsHelper.sendResponseSuccess = (res, status, data) => {
    return res.status(status).json({ success: true, data })
}

module.exports = utilsHelper