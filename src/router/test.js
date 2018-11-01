const Router = require('koa-router')
const Log4js = require('koa-log4')
const logger = Log4js.getLogger('weixin');
const RuleResult = require('../config/rule-result')
const TestRouter = new Router();
const queryString = require('query-string')
const appConfig = require('../../app');//引入配置文件
const Weixin = require('../controller/weixin')

TestRouter
    .post('/test', async(ctx) => {
       let cmd  = Weixin.getMemberCard()
        ctx.body = cmd
    })


module.exports = TestRouter;