const RuleResult = require('../config/rule-result')
const {cStatus,cCmdType,cUserType,cOpType,cUserOp} = require('../config/config')
const utilService = require('../service/util-service')
const dbService = require('../service/db-service')
const _ = require('lodash')
const moment = require('moment')
const redisService = require('../service/redis-service')
const GoodsController = require('./goods')

class MsgPush {
    constructor(){

    }
    async sysMsgPush(requestBody){
        let {op} = requestBody;
        switch (op) {
            case cOpType.get:
                return await this.itemGet(ctx)
            case cOpType.create:
                return await this.itemCreate(ctx)
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
        let {op,order,online,goodsId,ref,pic} = requestBody;
        // create
        let uuid =utilService.getUUID();
        let insertQuery = `insert into activity_info(??) values(?)`
        let propGroup = ['id']
        let valueGroup = [uuid]
        if(!utilService.isStringEmpty(order)){
            propGroup.push('order')
            valueGroup.push(order)
        }
        if(!utilService.isStringEmpty(online)){
            propGroup.push('online')
            valueGroup.push(online)
        }
        if(!utilService.isStringEmpty(goodsId)){
            propGroup.push('goodsId')
            valueGroup.push(goodsId)
        }
        if(!utilService.isStringEmpty(ref)){
            propGroup.push('ref')
            valueGroup.push(ref)
        }
        if(!utilService.isArrayEmpty(pic)){
            propGroup.push('pic')
            valueGroup.push(JSON.stringify(pic))
        }
        let insertResult = await dbService.commonQuery(insertQuery,[propGroup,valueGroup])
        return new RuleResult(cStatus.ok,{id:uuid})
    }

    async getItem(params){
        let {id,skip,filters,sorts} = params;
        filters = filters || {}
        sorts = sorts || []
        let {online,ctime} = filters;
        let whereGroup = []
        let orderGroup = []
        let paramsGroup = []

        if(!utilService.isStringEmpty(id)){
            whereGroup.push('ai.id = ?')
            paramsGroup.push(id)
        }else {
            orderGroup.unshift('ai.order asc')
        }
        if(!utilService.isStringEmpty(online)){
            whereGroup.push('ai.online = ?')
            paramsGroup.push(online)
        }
        if(!utilService.isStringEmpty((ctime||[])[0])){
            whereGroup.push('ai.ctime >= ?')
            paramsGroup.push((ctime||[])[0])
        }
        if(!utilService.isStringEmpty((ctime||[])[1])){
            whereGroup.push('ai.ctime <= ?')
            paramsGroup.push((ctime||[])[1])
        }

        // orderGroup.unshift('convert(ai.name using gbk) asc')
        // for(let sort of sorts){
        //     if(Array.isArray(sort) && (sort[1] === -1 || sort[1] === 1) && ['phone'].indexOf(sort[0]) > -1){
        //         orderGroup.unshift(`ai.${sort[0]} ${sort[1]>-1 ? 'asc' : 'desc'}`)
        //     }
        // }
        let detailQuery =
            `select
                    ai.id as id,     
                    ai.\`order\` as \`order\`,
                    ai.online as online,
                    ai.goodsId as goodsId,
                    ai.ref as ref,
                    ai.pic as pic,
                    ai.ctime as ctime
            from activity_info as ai
           `
        if(whereGroup.length > 0){
            detailQuery = `${detailQuery} where ${whereGroup.join(' and ')}`
        }
        if(orderGroup.length > 0){
            detailQuery = `${detailQuery} order by ${orderGroup.join(' , ')}`
        }
        let queryResult = await dbService.commonQuery(detailQuery,paramsGroup)
        for(let row of queryResult){
            if(!utilService.isStringEmpty(row.pic)){
                row.pic = JSON.parse(row.pic)
            }
            if(!utilService.isStringEmpty(row.goodsId)){
                let goodsDetailQuery = {
                    id:row.goodsId
                }
                let goodsDetail = await GoodsController.getItem(goodsDetailQuery)
                goodsDetail = (goodsDetail||[])[0]
                delete row.goodsId
                row.goods = goodsDetail
            }
        }
        return queryResult
    }
}

module.exports = new MsgPush();