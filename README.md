- **Deposit:** The service will listen from network for funding events from users to exchange, then create a balance hash to push to message queue. All messages follow the same format regardless to the currencies.
- **Withdrawal:** The service will create a unsigned transaction file, which need to be signed by a sign tool (cold wallet). The signed file will be broadcasted by the service too after that.
- **Settlement:** For some currencies, like Ethereum, the crypto assets from funding need to transfer to one address for withdrawal, the service provides ability to bundle these transactions for signing as the same as Withdrawal.

## Requirements

1. Install Docker CE

2. Install Node (for development)

3. Prepare docker-compose.yml

## Local development

1. Run database and message queue

   ```shell
   sudo docker-compose create wallet
   sudo docker network create wallet
   sudo docker-compose down
   sudo docker-compose up
   ```

2. Build wallet service app

   ```shell
   sudo docker-compose build wallet
   ```
   ```shell
   sudo docker-compose -f docker-compose-worker.yml build wallet
   ```

3. Run service

   ```shell
   sudo docker-compose -f docker-compose-worker.yml run --service-ports --rm wallet
   ```

   ```shell
   sudo docker-compose run --service-ports --rm wallet
   ```
