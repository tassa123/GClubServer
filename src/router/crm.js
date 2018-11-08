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
const YinBao = require('../controller/yinbao')
const path = require('path')
const fs = require('fs')
const YBAppID = '38E72CCD5D2A1245EBDE37D4487D6EB4'

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
    .post('/ticket', async(ctx) => {
        try {
            let requestBody = ctx.request.body || {}
            console.log(requestBody)
            ctx.body = {
                st:'ok',
                msg:'成功'
            }
            return
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
        ctx.body = {
            st:'success'
        }
        // 判断是否是会员消费
        requestBody = {
            cmd: 'ticket.new',
            timestamp: 1541597991909,
            bornTimeStamp: 1541597991206,
            version: '1.0',
            appId: '38E72CCD5D2A1245EBDE37D4487D6EB4',
            body: '{"sn":"201811072139446280008","uid":812042922159547394,"customerUid":716605181840344476,"customerBalanceUsedLogs":[{"usedMoney":584.00,"datetime":"2018-11-07 21:39:46","operateType":1,"afterUsedMoney":5716.60}],"customerPointGaintLogs":[]}'
        }
        // 判断结构
        if(!requestBody ||
            utilService.isStringEmpty(requestBody.body) ||
            requestBody.appId !== YBAppID ||
            requestBody.cmd !== 'ticket.new'
        ){
            return
        }
        let cmd = JSON.parse(requestBody.body)
        // 判断是否是会员消费
        if(!cmd.customerUid || 0 == cmd.customerUid){
            return
        }
        // 判断此会员是否在老鬼会员系统中
        let userExistResult =await UserController.itemExists({ybId:cmd.customerUid})
        if(0 === userExistResult.length){
            return
        }
        let userDetail = userExistResult[0]
        // 判断此订单是否在订单系统中核销过
        let orderExistResult =await UserController.itemExists({ybId:cmd.sn})
        if(orderExistResult.length > 0){
            return
        }
        // 获取订单详情
        let ybOrderResult = await YinBao.getOrderById(cmd.sn)
        if(!ybOrderResult || ybOrderResult.status !== 'success' || !ybOrderResult.data){
            return
        }
        let ybOrder = ybOrderResult.data
        // op,ybId,ticketId,ybOrder,payment,userId,goodsId,goods,type,status=cStatus.normal,ctime
        await OrderController.itemCreate({
            ybId:cmd.sn,
            goods:ybOrder,
            payment:ybOrder.totalAmount,
            userId:userDetail.id,
            type:cOrderType.bill,
            ctime:ybOrder.datetime
        })
    })




module.exports = CrmRouter;