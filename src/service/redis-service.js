const Log4js = require('koa-log4')
const logger = Log4js.getLogger('redis');
const redis = require('redis');
const appConfig = require('../../app');//引入配置文件
const BB = require('bluebird');
BB.promisifyAll(redis.RedisClient.prototype);
BB.promisifyAll(redis.Multi.prototype);

let client = redis.createClient({
    host:appConfig.redisHost,
    port:appConfig.redisPort
})
client.select(appConfig.redisDB,(err,res)=>{
    if(err){
        logger.error(err)
    }
});

client.on('error',err=>{
    logger.error(err)
})

client.on('connect',(info)=>{
    logger.info(`redis connected on port ${appConfig.redisHost}:${appConfig.redisPort}`)
})

client.on('reconnecting',()=>{
    logger.info('redis reconnected')
})

async function get(k) {
    return await client.getAsync(k);
}

async function set(k,v) {
    await client.setAsync(k,v,'EX', 2*60*60);
}


module.exports = {
    get:get,
    set:set
}