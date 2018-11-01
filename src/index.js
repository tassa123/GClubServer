'use strict';
const Koa = require('koa')
const Log4js = require('koa-log4')
const BodyParser = require('koa-bodyparser')
const koaBody = require('koa-body')
const xmlParser = require('koa-xml-body');
const {cStatus} = require('./config/config')
const RuleResult = require('./config/rule-result')
const logger = Log4js.getLogger('index');
const app = new Koa();
const DBService = require('./service/db-service')
const RedisService = require('./service/redis-service')
const moment = require('moment');
const appConfig = require('../app');//引入配置文件
// routers
const ApiRouter = require('./router/api')
// const WeixinRouter = require('./router/weixin')
const CrmRouter = require('./router/crm')
const Weixin = require('./controller/weixin')
const Test = require('./router/test')
app.use(xmlParser());
app.use(BodyParser())
// app.use(koaBody({ multipart: true }));

app
    // 路由分发
    .use(ApiRouter.routes())
    .use(ApiRouter.allowedMethods())
    // .use(WeixinRouter.routes())
    // .use(WeixinRouter.allowedMethods())
    .use(CrmRouter.routes())
    .use(CrmRouter.allowedMethods())
    .use(Test.routes())
    .use(Test.allowedMethods())
app.on('error', async(err, ctx) => {
    logger.error(err)
    logger.info(ctx.request.body)
})

async function main(){
    try {
        await DBService.initDB()
    }catch (e) {
        logger.error(e)
    }
}

main()

// port
app.listen(appConfig.serverPort);
logger.info(`server is running on port ${appConfig.serverPort}`);

