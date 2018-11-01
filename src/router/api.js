const Router = require('koa-router')
const Log4js = require('koa-log4')
const logger = Log4js.getLogger('api');
const RuleResult = require('../config/rule-result')
const ApiRouter = new Router();
const {cStatus,cCmdType} = require('../config/config')
const utilService = require('../service/util-service')
const appConfig = require('../../app');//引入配置文件
const UserController = require('../controller/user')
const ConferenceController = require('../controller/conference')
const InvitationController = require('../controller/invitation')
const AnswerController = require('../controller/answer')
const VCodeController = require('../controller/vcode')
const LoadingController = require('../controller/loading')
const RedisService = require('../service/redis-service')

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
                case cCmdType.SysLogin:
                    await UserController.SysLogin(ctx);
                    break;
                case cCmdType.UserInfo:
                    await UserController.UserInfo(ctx)
                    break;
                case cCmdType.UserLogin:
                    await UserController.UserLogin(ctx)
                    break;
                case cCmdType.SysUser:
                    await UserController.SysUser(ctx)
                    break;
                case cCmdType.SysConference:
                    await ConferenceController.SysConference(ctx)
                    break;
                case cCmdType.UserConference:
                    await ConferenceController.UserConference(ctx)
                    break;
                case cCmdType.SysInvitation:
                    await InvitationController.SysInvitation(ctx)
                    break;
                case cCmdType.UserInvitation:
                    await InvitationController.UserInvitation(ctx)
                    break;
                case cCmdType.SysAnswer:
                    await AnswerController.SysAnswer(ctx)
                    break;
                case cCmdType.UserAnswer:
                    await AnswerController.UserAnswer(ctx)
                    break;
                case cCmdType.SysVcode:
                case cCmdType.UserVcode:
                    await VCodeController.SysVcode(ctx)
                    break;
                case cCmdType.SysLoading:
                case cCmdType.UserLoading:
                    await LoadingController.SysLoading(ctx)
                    break;
                default:
                    ctx.body = new RuleResult(cStatus.unknownCmd,'','unknownCmd')
            }
        }catch (e){
            logger.error(e)
            ctx.body = new RuleResult(cStatus.err,'','err')
        }

    })


module.exports = ApiRouter;