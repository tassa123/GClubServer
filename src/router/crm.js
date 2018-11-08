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
            let {cmd,appkey,body} = requestBody
            if(cmd !== 'ticket.new'){
                ctx.body = {
                    st:cStatus.invalidParams,
                    msg:'cmd无效'
                }
                return
            }
            body = body ||{}
            let {orderNo,msgMobile,realPay,voucherId,status,addtime,tvList} = body;
            if(utilService.isStringEmpty(orderNo)){
                ctx.body = {
                    st:cStatus.invalidParams,
                    msg:'body.orderNo'
                }
                return
            }
            if(utilService.isStringEmpty(msgMobile)){
                ctx.body = {
                    st:cStatus.invalidParams,
                    msg:'body.msgMobile'
                }
                return
            }
            if(utilService.isStringEmpty(realPay)){
                ctx.body = {
                    st:cStatus.invalidParams,
                    msg:'body.realPay'
                }
                return
            }
            if(utilService.isStringEmpty(voucherId)){
                ctx.body = {
                    st:cStatus.invalidParams,
                    msg:'body.voucherId'
                }
                return
            }
            if(utilService.isStringEmpty(status)){
                ctx.body = {
                    st:cStatus.invalidParams,
                    msg:'body.status'
                }
                return
            }
            if(utilService.isStringEmpty(addtime)){
                ctx.body = {
                    st:cStatus.invalidParams,
                    msg:'body.addtime'
                }
                return
            }


            ctx.body = {
                st:'ok',
                msg:'成功'
            }
            
            // 判断订单是否已创建
            let orderResult = await OrderController.itemExists({ticketId:orderNo})
            if(orderResult.length > 0){
                logger.info(`票务已存在,id:${orderResult.id}  ticketId:${orderNo}`)
                return
            }
            let userId
            // 确认用户是否已经存在
            let userResult = await UserController.itemExists({phone:msgMobile})
            if(0 === userResult.length){
                // 如果该手机号没有注册会员 则主动注册 并短信通知
                let createCmd = {
                    phone:msgMobile,
                    type:cUserType.user,
                    status:cStatus.unactivated
                }
                await UserController.itemCreate(createCmd,true)
            }
            userResult = await UserController.itemExists({phone:msgMobile})
            let userDetail = userResult[0]
            if(userDetail.status === cStatus.unactivated){
                // todo 邀请注册会员
            }
            userId = userResult[0].id

            // 创建订单
            let orderCreateCmd = {
                ticketId:orderNo,
                payment:realPay,
                userId:userId,
                goods:body,
                type:cOrderType.ticket,
                ctime:addtime
            }
            await OrderController.itemCreate(orderCreateCmd)
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
            st:'success',
            msg:'成功'
        }
        try {
            // 判断结构
            if(!requestBody ||
                utilService.isStringEmpty(requestBody.body) ||
                requestBody.appId !== YBAppID ||
                requestBody.cmd !== 'ticket.new'
            ){
                ctx.body.msg = '不是订单事件'
                return
            }
            let cmd = JSON.parse(requestBody.body)
            // 判断是否是会员消费
            if(!cmd.customerUid || 0 == cmd.customerUid){
                ctx.body.msg = '不是会员消费'
                return
            }
            // 判断此会员是否在会员系统中
            let userResult =await UserController.itemExists({ybId:cmd.customerUid})
            if(0 === userResult.length){
                ctx.body.msg = '不是会员'
                return
            }
            let userDetail = userResult[0]
            // 判断此订单是否在订单系统中核销过
            let orderExistResult =await OrderController.itemExists({ybId:cmd.sn})
            if(orderExistResult.length > 0){
                ctx.body.msg = '订单已被核销'
                return
            }
            // 获取订单详情
            let ybOrderResult = await YinBao.getOrderById(cmd.sn)
            if(!ybOrderResult || ybOrderResult.status !== 'success' || !ybOrderResult.data){
                ctx.body.msg = '获取银豹订单失败'
                return
            }
            let ybOrder = ybOrderResult.data
            // 创建收银订单
            ctx.body = await OrderController.itemCreate({
                ybId:cmd.sn,
                goods:ybOrder,
                payment:ybOrder.totalAmount,
                userId:userDetail.id,
                type:cOrderType.bill,
                ctime:ybOrder.datetime
            })
        }catch (e) {
            logger.error(e)
            ctx.body = {
                st:'fail',
                msg:'系统错误'
            }
        }

    })




module.exports = CrmRouter;