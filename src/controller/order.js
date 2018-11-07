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
    async sysOrder(requestBody){
        let {op} = requestBody;
        switch (op) {
            case cOpType.get:
                return await this.itemGet(requestBody)
            case cOpType.create:
                return await this.itemCreate(requestBody)
            case cOpType.delete:
                return await this.itemDelete(requestBody)
            case cOpType.set:
                return await this.itemSet(requestBody)
            default:
                return  new RuleResult(cStatus.invalidParams,'','op');
        }
    }
    async itemGet(requestBody){
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
        return ruleResult
    }
    async itemCreate(requestBody){
        let {op,outId,endNum,payTime,payment,userId,phone,goodsId,goods,type,status=cStatus.normal,ctime} = requestBody;
        if([cOrderType.bill,cOrderType.exchange,cOrderType.ticket].indexOf(type) === -1){
            return new RuleResult(cStatus.invalidParams,null,'type')
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
            return new RuleResult(cStatus.notExists,null,'用户不存在')
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
                return new RuleResult(cStatus.invalidParams)
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
                return new RuleResult(cStatus.notExists,null,'订单不存在');
            }
            // 判断订单是否已经被核销
            let existResult = await this.itemExists({outId:outId})
            if(existResult.length > 0){
                return new RuleResult(cStatus.existing,null,'订单已被核销');
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
                return new RuleResult(cStatus.notExists,null,'没有对应商品')
            }
            goods = goodsDetail[0]
            // 判断商品是否可售
            if(goods.online !== 1){
                return new RuleResult(cStatus.notAllowed,null,'商品不可售')
            }
            // 判断库存是否充足
            if(goods.amount < 1){
                return new RuleResult(cStatus.shortOfGoods,null,'商品库存不足')
            }
            // 判断积分是否足够
            if(userDetail.score < goods.score){
                return new RuleResult(cStatus.shortOfFund,null,'积分不足')
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
                })
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
        return new RuleResult(cStatus.ok,{id:uuid})
    }
    async itemDelete(requestBody){
        let {op,id} = requestBody;
        let deleteQuery =  `update order_info set del = 1 where id = ?`
        let deleteResult = await dbService.commonQuery(deleteQuery,[id])
        return new RuleResult(cStatus.ok)
    }
    async itemSet(requestBody){
        let {op,status,id,operatorId} = requestBody;
        let columnGroup = []
        let paramGroup = []
        if(status && status !== cStatus.acked){
            return new RuleResult(cStatus.invalidParams,null,'status')
        }
        if(status === cStatus.acked){
            // 判断是否已经核销了
            let existResult = await this.itemExists({id})
            let itemDetail = existResult[0]
            if(itemDetail.status === cStatus.acked){
                return new RuleResult(cStatus.acked,null,'已核销')
            }
            let operatorResult = await User.getItem({id:operatorId})
            let operatorDetail = (operatorResult||[])[0]||{}
            columnGroup.push('status = ?')
            paramGroup.push(cStatus.acked)
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
        return new RuleResult(cStatus.ok)
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

        if(!utilService.isArrayEmpty(type)){
            whereGroup.push('oi.type in (?)')
            paramsGroup.push(type)
        }

        if(!utilService.isArrayEmpty(status)){
            whereGroup.push('oi.status in (?)')
            paramsGroup.push(status)
        }

        if(!utilService.isStringEmpty(userId)){
            whereGroup.push('oi.userId = ?')
            paramsGroup.push(`${userId}`)
        }

        if(!utilService.isStringEmpty(goodsId)){
            whereGroup.push('oi.goodsId = ?')
            paramsGroup.push(`${goodsId}`)
        }

        if(!utilService.isStringEmpty(outId)){
            whereGroup.push('oi.outId = ?')
            paramsGroup.push(`${outId}`)
        }

        if(!utilService.isStringEmpty((score||[])[0])){
            whereGroup.push('oi.score >= ?')
            paramsGroup.push((score||[])[0])
        }
        if(!utilService.isStringEmpty((score||[])[1])){
            whereGroup.push('oi.score <= ?')
            paramsGroup.push((score||[])[1])
        }

        if(!utilService.isStringEmpty((ctime||[])[0])){
            whereGroup.push('oi.ctime >= ?')
            paramsGroup.push((ctime||[])[0])
        }
        if(!utilService.isStringEmpty((ctime||[])[1])){
            whereGroup.push('oi.ctime <= ?')
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
                    oi.outId as outId,
                    oi.userId as userId,
                    oi.goodsId as goodsId,
                    ${goods ? 'oi.goods as goods,':''}   
                     ${logs ? 'oi.logs as logs,':''}                
                    oi.score as score,
                    oi.type as type,
                    oi.status as status,
                    oi.ctime as ctime
            from order_info as oi
           `
        let allQuery =
            `select count(*) as tnum 
             from order_info as oi`
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

        for(let row of queryResult) {
            if (!utilService.isStringEmpty(row.goods)) {
                row.goods = JSON.parse(row.goods)
                row.goods.id = _.cloneDeep(row.goodsId)
            }
            delete row.goodsId
            if (!utilService.isStringEmpty(row.logs)) {
                row.logs = JSON.parse(row.logs)
            }
            // let userResult = await User.getItem({id: row.userId})
            // let userDetail = userResult[0] || {}
            row.user = {
                id:row.userId,
            }
            delete  row.userId
        }

        if(!utilService.isNullOrUndefined(countInfo) && !utilService.isNullOrUndefined(countInfo.tnum)){
            let tnumResult = await dbService.commonQuery(allQuery,paramsGroup)
            countInfo.tnum = tnumResult[0].tnum
            countInfo.tpage = Math.ceil(tnumResult[0].tnum/limit)
            countInfo.hasMore = (skip+limit)<tnumResult[0].tnum
        }
        return queryResult
    }
}

module.exports = new Order();