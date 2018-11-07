const Router = require('koa-router')
const Log4js = require('koa-log4')
const logger = Log4js.getLogger('crm');
const RuleResult = require('../config/rule-result')
const CrmRouter = new Router();
const queryString = require('query-string')
const appConfig = require('../../app');//引入配置文件
const utilService = require('../service/util-service')
const moment = require('moment')
const {cStatus,cCmdType,cUserType,cOpType,cUserOp,cOrderType} = require('../config/config')
const _ = require('lodash')
const UserController = require('../controller/user')
const OrderController = require('../controller/order')
const path = require('path')
const fs = require('fs')

{
    let secretcode = 'ABCDEFG'
    let appkey = 'appkey'
    let timestamp = moment().format('YYYY-MM-DD HH:mm:ss')
    let sign; // 不加密
    let signmethod = 'MD5' // 不加密
    let format = 'json'
    let v = '1.0'
    let method = 'ticket.api.stadium.get'
    let str=`appkey=${appkey}&format=${format}&method=${method}&timestamp=${timestamp}&v=${v}${secretcode}`
    sign = utilService.string2MD5(str)
    // console.log(sign,timestamp)
}
CrmRouter
    .post('/ticket/notice', async(ctx) => {
        try {
            let requestBody = ctx.request.body || {}
            let headers = ctx.request.headers;
            let {orderNo,msgMobile,realPay,voucherId,status,addtime,tvList} = requestBody
            if(utilService.isStringEmpty(orderNo) ||
                utilService.isStringEmpty(msgMobile) ||
                utilService.isStringEmpty(realPay) ||
                utilService.isStringEmpty(voucherId) ||
                utilService.isStringEmpty(status)
            ){
                ctx.body = {
                    st:'invalidParams',
                    msg:'缺少参数'
                }
                return
            }
            // 判断订单是否已创建
            let orderuserExistResult = await OrderController.itemExists({outId:orderNo})
            if(orderuserExistResult.length > 0){
                ctx.body = {
                    st:'existing',
                    msg:'订单已存在'
                }
                return
            }
            let userId
            // 确认用户是否已经存在
            let userExistResult = await UserController.itemExists({phone:msgMobile})
            if(0 === userExistResult.length){
                // 如果该手机号没有注册会员 则主动注册 并短信通知
                let createCmd = {
                    phone:msgMobile,
                    type:cUserType.user,
                    status:cStatus.unactivated
                }
                let result = await UserController.itemCreate(createCmd,true)
                userId= result.data.id
                // todo 短信推送
            }else {
                userId = userExistResult[0].id
            }
            // 创建订单
            let orderCreateCmd = {
                outId:orderNo,
                userId:userId,
                goods:requestBody,
                payment:realPay,
                type:cOrderType.ticket,
                ctime:addtime
            }
            let orderCreateResult = await OrderController.itemCreate(orderCreateCmd,true)
            ctx.body = {
                st:'ok',
                msg:''
            }

        }catch (e){
            logger.error(e)
            ctx.body = {
                st:'fail',
                msg:'失败'
            }
        }
    })
    .post('/yinbao', async(ctx) => {
        let requestBody = ctx.request.body || {}
        let dataFile =  path.resolve(__dirname,'..','..','yinbao.txt')
        try {
            fs.appendFileSync(dataFile,JSON.stringify(requestBody))
        }catch (e) {
            console.log('yinbao error')
        }
        ctx.body = {
            st:'success'
        }
    })




module.exports = CrmRouter;