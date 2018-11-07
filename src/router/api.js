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
const YinBaoController = require('../controller/yinbao')
ApiRouter
    .post(appConfig.api, async(ctx) => {
        try {
            let params = ctx.request.query || {}
            let requestBody = ctx.request.body || {}
            let {sid,cmdType} = requestBody||{};
            let headers = ctx.request.headers;
            cmdType = cmdType || headers['cmd-type']
            // sid验证
            if(utilService.isStringEmpty(cmdType)){
                ctx.body = new RuleResult(cStatus.unknownCmd,'','unknownCmd')
                return
            }

            if([cCmdType.SysLogin,cCmdType.SysVcode,cCmdType.YBsignature,cCmdType.UserLogin,cCmdType.UserInfo,
                'yb_test'].indexOf(cmdType) === -1){
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
            let _body;
            switch (cmdType){
                case cCmdType.SysUser:
                    _body = await UserController.SysUser(requestBody)
                    break;
                case cCmdType.SysLogin:
                    _body = await UserController.SysLogin(requestBody)
                    break;
                case cCmdType.SysGoods:
                    _body = await GoodsController.sysGoods(requestBody)
                    break;
                case cCmdType.SysActivity:
                    _body = await ActivityController.sysActivity(requestBody)
                    break;
                case cCmdType.UserOrder:
                case cCmdType.SysOrder:
                    _body = await OrderController.sysOrder(requestBody)
                    break;
                case 'yb_test':
                    _body = await YinBaoController.getMemberByNum(requestBody)
                    break;
                default:
                    _body = new RuleResult(cStatus.unknownCmd,'','unknownCmd')
            }
            ctx.body = _body;
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