const RuleResult = require('../config/rule-result')
const Op = require('../config/op')
const {cStatus,cCmdType,cUserType,cOpType,cUserOp,cOrderType} = require('../config/config')
const utilService = require('../service/util-service')
const dbService = require('../service/db-service')
const _ = require('lodash')
const moment = require('moment')
const redisService = require('../service/redis-service')
const Goods = require('./goods')
const User = require('./user')
const Log = require('./log')
const YinBao = require('./yinbao')

class Order {
    constructor(){

    }
    async sysOrder(ctx){
        let ruleResult = new RuleResult()
        let params = ctx.request.query || {}
        let requestBody = ctx.request.body || {}
        let cmdType = (requestBody || {}).cmdType;
        let {op} = requestBody;
        switch (op) {
            case cOpType.get:
                await this.itemGet(ctx)
                break;
            case cOpType.create:
                await this.itemCreate(ctx)
                break;
            case cOpType.delete:
                await this.itemDelete(ctx)
                break;
            case cOpType.set:
                await this.itemSet(ctx)
                break;
            default:
                ctx.body =  new RuleResult(cStatus.invalidParams,'','op');
                break;
        }
    }
    async userOrder(ctx){
        let requestBody = ctx.request.body || {}
        let {op} = requestBody;
        switch (op) {
            case cOpType.get:
                await this.itemGet(ctx)
                break;
            case cOpType.create:
                await this.itemCreate(ctx)
                break;
            case cOpType.delete:
                await this.itemDelete(ctx)
                break;
            case cOpType.set:
                await this.itemSet(ctx)
                break;
            default:
                ctx.body =  new RuleResult(cStatus.invalidParams,'','op');
                break;
        }
    }
    async itemGet(ctx){
        let requestBody = ctx.request.body || {}
        let cmdType = (requestBody || {}).cmdType;
        let {id,pageNum} = requestBody;
        let ruleResult = new RuleResult()
        let countInfo ={
            tnum:0,
            tpage:0,
            hasMore:true,
            pageNum:pageNum||10
        }
        let userResult =await this.getItem(requestBody,countInfo)
        if(!utilService.isStringEmpty(id)){
            if(0 === userResult.length){
                ruleResult.setSt(cStatus.notExists)
            }else {
                ruleResult.setData(userResult[0])
            }
        }else {
            ruleResult.setData(userResult)
            ruleResult['tnum'] = countInfo.tnum
            ruleResult['tpage'] = countInfo.tpage
            ruleResult['pageNum'] = countInfo.pageNum
            ruleResult.setSt(countInfo.hasMore ? cStatus.ok : cStatus.noMore)
        }
        ctx.body = ruleResult
    }
    async itemCreate(ctx,innerCall = false){
        let requestBody = innerCall ? ctx : ctx.request.body || {}
        let {op,outId,endNum,payTime,payment,userId,phone,goodsId,goods,type,status=cStatus.normal,ctime} = requestBody;
        if([cOrderType.bill,cOrderType.exchange,cOrderType.ticket].indexOf(type) === -1){
            ctx.body = new RuleResult(cStatus.invalidParams,null,'type')
            return
        }
        let log={};
        let score;
        let rate=1.00;
        // create
        let uuid =utilService.getUUID();
        let insertQuery = `insert into order_info(??) values(?)`
        let propGroup = ['id']
        let valueGroup = [uuid]

        let userExistResult =await User.itemExists({_buffer:'or',id:userId,phone:phone})
        if(userExistResult.length === 0){
            ctx.body = new RuleResult(cStatus.notExists,null,'用户不存在')
            return
        }
        let userDetail = userExistResult[0]
        // 处理积分购物
        if(type === cOrderType.exchange){
            log = new Op(userDetail.name)
            log.operatorId = userDetail.id
            log.op = cOpType.create
        }
        // 处理收银系统
        if(type === cOrderType.bill){
            if(utilService.isStringEmpty(userId) ||
                utilService.isStringEmpty(endNum)
            ){
                ctx.body = new RuleResult(cStatus.invalidParams)
                return
            }
            let payDay = moment(payTime).format('YYYY-MM-DD')
            let timeSpan = [`${payDay} 00:00:00`,`${payDay} 23:59:59`]
            let orderResult = await YinBao.getBill(timeSpan)
            let orderList = orderResult.data.result || []
            let endNumReg = new RegExp(".*"+endNum.toString()+"$")
            let curOrder = _.find(orderList,(order)=>{
                outId = order.sn.toString();
                return endNumReg.test(outId) && order.invalid === 0;
            })
            if(!curOrder){
                // 订单不存在
                ctx.body = new RuleResult(cStatus.notExists,null,'订单不存在');
                return
            }
            // 判断订单是否已经被核销
            let existResult = await this.itemExists({outId:outId})
            if(existResult.length > 0){
                ctx.body = new RuleResult(cStatus.existing,null,'订单已被核销');
                return
            }

            ctime = utilService.getTimeStamp(curOrder.datetime)
            log = new Op(userDetail.name,`线下消费${curOrder.totalAmount}`,ctime)
            log.operatorId = userDetail.id
            log.op = cOpType.create
            goods = curOrder;
            score = parseInt(curOrder.totalAmount * rate)
        }

        // 处理票务系统
        if(type === cOrderType.ticket){
            log = new Op(userDetail.name,`购票消费${payment}`,utilService.getTimeStamp(ctime))
            log.operatorId = userDetail.id
            log.op = cOpType.create
            score = parseInt(payment * rate)
        }

        if(!utilService.isStringEmpty(goodsId)){
            // 自动绑定当前对应的商品信息
            let goodsCmd = {
                id:goodsId
            }
            let goodsDetail = await Goods.getItem(goodsCmd)
            if(goodsDetail.length === 0){
                ctx.body = new RuleResult(cStatus.notExists,null,'没有对应商品')
                return
            }
            goods = goodsDetail[0]
            // 判断商品是否可售
            if(goods.online !== 1){
                ctx.body = new RuleResult(cStatus.notAllowed,null,'商品不可售')
                return
            }
            // 判断库存是否充足
            if(goods.amount < 1){
                ctx.body = new RuleResult(cStatus.shortOfGoods,null,'商品库存不足')
                return
            }
            // 判断积分是否足够
            if(userDetail.score < goods.score){
                ctx.body = new RuleResult(cStatus.shortOfFund,null,'积分不足')
                return
            }
            score = parseInt(goods.score * rate)
            log.msg = `消耗${score}积分兑换`
            log.op = cOpType.create
        }

        if(!utilService.isStringEmpty(outId)){
            propGroup.push('outId')
            valueGroup.push(outId)
        }
        if(!utilService.isStringEmpty(userId)){
            propGroup.push('userId')
            valueGroup.push(userId)
        }
        if(!utilService.isStringEmpty(goodsId)){
            propGroup.push('goodsId')
            valueGroup.push(goodsId)
        }
        if(!utilService.isNullOrUndefined(goods)){
            propGroup.push('goods')
            valueGroup.push(JSON.stringify(goods))
        }
        if(!utilService.isStringEmpty(score)){
            propGroup.push('score')
            valueGroup.push(score)
        }
        if(!utilService.isStringEmpty(type)){
            propGroup.push('type')
            valueGroup.push(type)
        }
        if(!utilService.isStringEmpty(status)){
            propGroup.push('status')
            valueGroup.push(status)
        }
        if(!utilService.isStringEmpty(rate)){
            propGroup.push('rate')
            valueGroup.push(rate)
        }
        if(!utilService.isStringEmpty(ctime)){
            propGroup.push('ctime')
            valueGroup.push(ctime)
        }
        if(!utilService.isNullOrUndefined(log)){
            propGroup.push('logs')
            valueGroup.push(JSON.stringify([log]))
        }

        if(type === cOrderType.exchange){
            // 用户扣除积分
            let subQuery =`
                update user_info set
                score = (score - ?)
                where id = ?
            `
            await dbService.commonQuery(subQuery,[score,userDetail.id])
            // 添加积分记录
            await Log.itemCreate(
                {
                    userId:userDetail.id,
                    orderId:uuid,
                    msg:`兑换${goods.name}`,
                    score:-Math.abs(score)
                },true)
        }
        if(type === cOrderType.bill){
            // 用户增加积分
            let subQuery =`
                update user_info set
                score = (score + ?)
                where id = ?
            `
            await dbService.commonQuery(subQuery,[score,userDetail.id])
            // 添加积分记录
            await Log.itemCreate(
                {
                    userId:userDetail.id,
                    orderId:uuid,
                    msg:`线下消费${goods.totalAmount}`,
                    score:score
                },true)
        }
        if(type === cOrderType.ticket){
            // 用户增加积分
            let subQuery =`
                update user_info set
                score = (score + ?)
                where id = ?
            `
            await dbService.commonQuery(subQuery,[score,userDetail.id])
            // 添加积分记录
            await Log.itemCreate(
                {
                    userId:userDetail.id,
                    orderId:uuid,
                    msg:`购票消费${payment}`,
                    score:score
                },true)
        }
        // todo 积分变动检查用户等级

        // 添加订单记录
        let insertResult = await dbService.commonQuery(insertQuery,[propGroup,valueGroup])
        if(type === cOrderType.exchange){
            // 操作库存
            let subQuery =`
                update goods_info set
                amount = (amount - 1)
                where id = ?
            `
            await dbService.commonQuery(subQuery,[goods.id])
        }
        ctx.body = new RuleResult(cStatus.ok,{id:uuid})
    }
    async itemDelete(ctx){
        let params = ctx.request.query || {}
        let requestBody = ctx.request.body || {}
        let cmdType = (requestBody || {}).cmdType;
        let {op,id} = requestBody;
        let deleteQuery =  `update order_info set del = 1 where id = ?`
        let deleteResult = await dbService.commonQuery(deleteQuery,[id])
        ctx.body = new RuleResult(cStatus.ok)
        return
    }
    async itemSet(ctx){
        let params = ctx.request.query || {}
        let requestBody = ctx.request.body || {}
        let cmdType = (requestBody || {}).cmdType;
        let {op,status,id,operatorId} = requestBody;
        let columnGroup = []
        let paramGroup = []
        if(status === cStatus.finished){
            // 判断是否已经核销了
            let existResult = await this.itemExists({id})
            let itemDetail = existResult[0]
            if(itemDetail.status === cStatus.finished){
                ctx.body= new RuleResult(cStatus.existing,null,'已核销')
                return
            }
            let operatorResult = await User.getItem({id:operatorId})
            let operatorDetail = (operatorResult||[])[0]||{}
            columnGroup.push('status = ?')
            paramGroup.push(cStatus.finished)
            columnGroup.push(`
            logs = JSON_ARRAY_INSERT(
        (case
            when JSON_LENGTH(logs) <= 0 then '[]'
            when JSON_LENGTH(logs) is null then '[]'
            else logs end), 
        '$[0]', CAST(? AS JSON))
            `)
            let log = new Op(operatorDetail.name)
            log.operatorId = operatorId
            log.setMsg(`${operatorDetail.name}核销了此券`)
            log.op = cOpType.check
            paramGroup.push(JSON.stringify(log))
        }
        paramGroup.push(id)
        let setQuery = `update order_info set ${columnGroup.join(',')} where id = ?`
        let setResult = await dbService.commonQuery(setQuery,paramGroup)
        ctx.body= new RuleResult(cStatus.ok)
        return
    }
    async itemExists({_buffer,id,outId,...others},_whereGroup,_paramGroup){
        _whereGroup = _whereGroup || []
        let whereGroup = [];
        let paramGroup = _paramGroup || [];
        let buffer = _buffer || 'and'
        if(!utilService.isStringEmpty(id)){
            whereGroup.push('id = ?')
            paramGroup.push(id)
        }
        if(!utilService.isStringEmpty(outId)){
            whereGroup.push('outId = ?')
            paramGroup.push(outId)
        }
        if(whereGroup.length>0){
            whereGroup[0] = `(${whereGroup[0]}`
            whereGroup[whereGroup.length-1] = `${whereGroup[whereGroup.length-1]})`
        }

        let existQuery = `select 
                         id,
                         del,
                         status,
                         userId
                         from order_info 
                    ${_whereGroup.length>0 ?'where '+ _whereGroup.join(` ${buffer} `) : ''}
                    ${_whereGroup.length === 0 && whereGroup.length > 0 ? 'where '+whereGroup.join(` ${buffer} `) : ''}
                    ${_whereGroup.length > 0 && whereGroup.length > 0 ? 'and '+whereGroup.join(` ${buffer} `) : ''}
                     limit 1`
        let existResult = await dbService.commonQuery(existQuery,paramGroup)
        return existResult
    }
    async getItem(params,countInfo){
        let {id,skip,pageNum,filters,sorts,additions} = params;
        skip = skip || 0;
        filters = filters || {}
        sorts = sorts || []
        additions = additions || {}
        let {userId,type,status,ctime,goodsId,outId,score} = filters;
        let {logs,goods} = additions;
        let limit = pageNum || 10;
        let whereGroup = []
        let orderGroup = []
        let paramsGroup = []

        if(!utilService.isStringEmpty(id)){
            whereGroup.push('oi.id = ?')
            paramsGroup.push(id)
            limit = 1
            skip = 0
        }else {
            whereGroup.push('oi.del != 1')
            orderGroup.unshift('oi.ctime desc')
        }
        if(!utilService.isStringEmpty(name)){
            whereGroup.push('oi.name like ?')
            paramsGroup.push(`%${name}%`)
        }
        if(!utilService.isStringEmpty((amount||[])[0])){
            whereGroup.push('oi.amount > ?')
            paramsGroup.push((amount||[])[0])
        }
        if(!utilService.isStringEmpty((amount||[])[1])){
            whereGroup.push('oi.amount < ?')
            paramsGroup.push((amount||[])[1])
        }
        if(!utilService.isStringEmpty((score||[])[0])){
            whereGroup.push('oi.score > ?')
            paramsGroup.push((score||[])[0])
        }
        if(!utilService.isStringEmpty((score||[])[1])){
            whereGroup.push('oi.score < ?')
            paramsGroup.push((score||[])[1])
        }
        if(!utilService.isStringEmpty(online)){
            whereGroup.push('oi.online = ?')
            paramsGroup.push(online)
        }

        if(!utilService.isStringEmpty((ctime||[])[0])){
            whereGroup.push('oi.ctime > ?')
            paramsGroup.push((ctime||[])[0])
        }
        if(!utilService.isStringEmpty((ctime||[])[1])){
            whereGroup.push('oi.ctime < ?')
            paramsGroup.push((ctime||[])[1])
        }

        // orderGroup.unshift('convert(oi.name using gbk) asc')
        // for(let sort of sorts){
        //     if(Array.isArray(sort) && (sort[1] === -1 || sort[1] === 1) && ['phone'].indexOf(sort[0]) > -1){
        //         orderGroup.unshift(`oi.${sort[0]} ${sort[1]>-1 ? 'asc' : 'desc'}`)
        //     }
        // }
        let detailQuery =
            `select
                    oi.id as id,
                    oi.del as del,
                    oi.amount as amount,
                    oi.online as online,
                    oi.name as name,
                    oi.score as score,
                    oi.des as des,
                    oi.pic as pic,
                    oi.ctime as ctime
            from order_info as gi
           `
        let allQuery = `select count(*) as tnum from order_info as gi`
        if(whereGroup.length > 0){
            detailQuery = `${detailQuery} where ${whereGroup.join(' and ')}`
            allQuery = `${allQuery} where ${whereGroup.join(' and ')}`
        }
        if(orderGroup.length > 0){
            detailQuery = `${detailQuery} order by ${orderGroup.join(' , ')}`
        }
        if(limit){
            detailQuery = `${detailQuery} limit ${skip},${limit}`
        }
        let queryResult = await dbService.commonQuery(detailQuery,paramsGroup)
        let tnumResult = await dbService.commonQuery(allQuery,paramsGroup)
        for(let row of queryResult){
            if(!utilService.isStringEmpty(row.pic)){
                row.pic = JSON.parse(row.pic)
            }
        }
        if(!utilService.isNullOrUndefined(countInfo) && !utilService.isNullOrUndefined(countInfo.tnum)){
            countInfo.tnum = tnumResult[0].tnum
            countInfo.tpage = Math.ceil(tnumResult[0].tnum/limit)
            countInfo.hasMore = (skip+limit)<tnumResult[0].tnum
        }
        return queryResult
    }
}

module.exports = new Order();