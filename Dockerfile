FROM node:16.13.1

COPY package.json yarn.lock /usr/src/wallet/

WORKDIR /usr/src/wallet

RUN yarn install

COPY . /usr/src/wallet/

# Run app as node user
USER node

# Expose port
EXPOSE 3001

# Start the app
CMD ["npm", "start"]
