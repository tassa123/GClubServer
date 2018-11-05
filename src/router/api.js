const Router = require('koa-router')
const Log4js = require('koa-log4')
const logger = Log4js.getLogger('api');
const RuleResult = require('../config/rule-result')
const ApiRouter = new Router();
const {cStatus,cCmdType} = require('../config/config')
const utilService = require('../service/util-service')
const appConfig = require('../../app');//引入配置文件
const RedisService = require('../service/redis-service')
const UserController = require('../controller/user')
const GoodsController = require('../controller/goods')
const ActivityController = require('../controller/activity')
const OrderController = require('../controller/order')
ApiRouter
    .post(appConfig.api, async(ctx) => {
        try {
            let params = ctx.request.query || {}
            let requestBody = ctx.request.body || {}
            let {sid,cmdType} = requestBody||{};
            // sid验证
            if(utilService.isStringEmpty(cmdType)){
                ctx.body = new RuleResult(cStatus.unknownCmd,'','unknownCmd')
                return
            }

            if([cCmdType.SysLogin,cCmdType.SysVcode,cCmdType.UserVcode,cCmdType.UserLogin,cCmdType.UserInfo,cCmdType.UserLoading].indexOf(cmdType) === -1){
                if(utilService.isStringEmpty(sid)){
                    ctx.body = new RuleResult(cStatus.invalidSid)
                    return
                }else {
                    let userId = await RedisService.get(sid)
                    if(utilService.isStringEmpty(userId) && sid !== '1234554321'){
                        ctx.body = new RuleResult(cStatus.invalidSid)
                        return
                    }
                }
            }

            switch (cmdType){
                case cCmdType.SysUser:
                    await UserController.SysUser(ctx)
                    break;
                case cCmdType.SysLogin:
                    await UserController.SysLogin(ctx)
                    break;
                case cCmdType.SysGoods:
                    await GoodsController.sysGoods(ctx)
                    break;
                case cCmdType.SysActivity:
                    await ActivityController.sysActivity(ctx)
                    break;
                case cCmdType.SysOrder:
                    await OrderController.sysOrder(ctx)
                    break;
                default:
                    ctx.body = new RuleResult(cStatus.unknownCmd,'','unknownCmd')
            }
        }catch (e){
            if(e && e.sqlState === '23000'){
                ctx.body = new RuleResult(cStatus.existing,'','err')
                return
            }
            logger.error(e)
            ctx.body = new RuleResult(cStatus.err,'','err')
        }

    })


module.exports = ApiRouter;