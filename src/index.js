const _ = require('lodash');
const debug = require('debug');
const Decimal = require('decimal.js');
const mongoose = require("mongoose");
const mongoURI = process.env.MONGODB_URI;

const { create: createContainer, provision: provisionContainer } = require('./container');
const { create: createWorker } = require('./app/worker');
const { create: createServer } = require('./app/server');
// const { create: createChannel } = require('./app/channel');

const log = {
    info: debug('wallet:app'),
    error: debug('wallet:app:error'),
};

// Setup global precision
Decimal.set({ precision: 100 });

async function startServer(container, serviceNames) {
    const port = process.env.PORT || 3001;

    // Create container & provision env
    const services = serviceNames.map((name) => {
        const service = container.resolve(_.camelCase(`${name}_SERVICE`));
        service.name = name.toUpperCase();
        return service;
    });

    // Create server
    const server = await createServer({ port, services });
    // Then start
    return { server };
}

async function startWorker(container, monitorName) {
    // Load worker
    const monitor = container.resolve(_.camelCase(`${monitorName}_MONITOR`));
    monitor.name = monitorName;

    // Load mq channel & balancesHash db
    // const channel = await createChannel({ container });
    const balancesHash = container.resolve('balancesHash');

    // Then listen & start
    const worker = createWorker({ monitor, balancesHash });
    worker.start().catch((err) => {
        log.error('worker.err:', err);
        process.exit(1);
    });

    log.info('MQ is listening to block service');

    return { worker };
}

async function start() {
    const type = process.env.SERVICE_TYPE;

    await mongoose
        .connect(mongoURI, {
            // some options to deal with deprecated warning
            useCreateIndex: true,
            useNewUrlParser: true,
            useFindAndModify: false,
            useUnifiedTopology: true,
        })
        .then(() => {
            console.log(`Mongoose connected successfully`);
        })
        .catch((err) => {
            console.log(err)
            throw Error('Mongoose connect error : ', err)
        });

    const serviceNames = process.env.SERVICE_NAMES.toUpperCase().split(',');
    if (serviceNames.length === 0) {
        throw Error('At least 1 service name must be specified');
    }

    const container = provisionContainer(createContainer(), serviceNames);
    // Preload data

    switch (type) {
        case 'worker':
            return startWorker(container, serviceNames[0]);
        case 'server':
            return startServer(container, serviceNames);
        default:
            throw Error(`Service with type ${type} is not supported`);
    }
}

// Graceful shutdown
async function shutdown({ worker, server }) {
    log.info('Received kill signal, shutting down gracefully');
    if (server) {
        server.close();
        log.info('Closed out remaining connections');
        process.exit(0);
    }

    // We will wait for 1 minute, after that we force the process to shutdown
    const forceExit = setTimeout(() => {
        log.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 60 * 1000);

    // Stop the only worker
    if (worker) {
        await worker.stop();
    }

    clearTimeout(forceExit);
    process.exit(0);
}

// Register signals for app
const registerSignals = (app) => {
    process.on('SIGTERM', () => shutdown(app));
    process.on('SIGINT', () => shutdown(app));
};

start()
    .then(registerSignals)
    .catch((err) => {
        log.error(err);
        process.exit(1);
    });
