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
    async sysActivity(ctx){
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
    async userActivity(ctx){
        let params = ctx.request.query || {}
        let requestBody = ctx.request.body || {}
        let cmdType = (requestBody || {}).cmdType;
        let {accountName,password} = requestBody;
        if(utilService.isStringEmpty(accountName) || utilService.isStringEmpty(password)){
            ctx.body = new RuleResult(cStatus.invalidParams);
            return
        }
        let loginQuery =
            `select id
        from user_info
        where type in (?) and accountName = ?  and password = ?
        limit 1`
        let loginResult =await dbService.commonQuery(loginQuery,[[cUserType.sys],accountName,password])
        if(loginResult.length > 0){
            let id = loginResult[0].id;
            let detailResult = await this.getItem({id})
            let detail = detailResult[0]
            let sid = utilService.getSID();
            await redisService.set(sid,id)
            detail.sid = sid
            ctx.body = new RuleResult(cStatus.ok,detail);
        }else {
            ctx.body = new RuleResult(cStatus.notExists);
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
    async itemCreate(ctx){
        let params = ctx.request.query || {}
        let requestBody = ctx.request.body || {}
        let cmdType = (requestBody || {}).cmdType;
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
        ctx.body = new RuleResult(cStatus.ok,{id:uuid})
    }
    async itemDelete(ctx){
        let params = ctx.request.query || {}
        let requestBody = ctx.request.body || {}
        let cmdType = (requestBody || {}).cmdType;
        let {op,id} = requestBody;
        let deleteQuery =  `delete from activity_info where id = ?`
        let deleteResult = await dbService.commonQuery(deleteQuery,[id])
        ctx.body = new RuleResult(cStatus.ok)
        return
    }
    async itemSet(ctx){
        let params = ctx.request.query || {}
        let requestBody = ctx.request.body || {}
        let cmdType = (requestBody || {}).cmdType;
        let {op,id,order,online,goodsId,ref,pic} = requestBody;
        let columnGroup = []
        let paramGroup = []
        if(!utilService.isStringEmpty(order)){
            columnGroup.push('`order` = ?')
            paramGroup.push(order)
        }
        if(!utilService.isStringEmpty(online)){
            columnGroup.push('online = ?')
            paramGroup.push(online)
        }
        if(!utilService.isStringEmpty(goodsId)){
            columnGroup.push('goodsId = ?')
            paramGroup.push(goodsId)
        }
        if(!utilService.isStringEmpty(ref)){
            columnGroup.push('ref = ?')
            paramGroup.push(ref)
        }
        if(!utilService.isArrayEmpty(pic)){
            columnGroup.push('pic = ?')
            paramGroup.push(JSON.stringify(pic))
        }
        paramGroup.push(id)
        let setQuery = `update activity_info set ${columnGroup.join(',')} where id = ?`
        let setResult = await dbService.commonQuery(setQuery,paramGroup)
        ctx.body= new RuleResult(cStatus.ok)
        return
    }
    async itemExists({_buffer,id,...others},_whereGroup,_paramGroup){
        _whereGroup = _whereGroup || []
        let whereGroup = [];
        let paramGroup = _paramGroup || [];
        let buffer = _buffer || 'and'
        if(!utilService.isStringEmpty(id)){
            whereGroup.push('id = ?')
            paramGroup.push(id)
        }
        if(whereGroup.length>0){
            whereGroup[0] = `(${whereGroup[0]}`
            whereGroup[whereGroup.length-1] = `${whereGroup[whereGroup.length-1]})`
        }

        let existQuery = `select 
                         id,
                         del
                         from activity_info 
                    ${_whereGroup.length>0 ?'where '+ _whereGroup.join(` ${buffer} `) : ''}
                    ${_whereGroup.length === 0 && whereGroup.length > 0 ? 'where '+whereGroup.join(` ${buffer} `) : ''}
                    ${_whereGroup.length > 0 && whereGroup.length > 0 ? 'and '+whereGroup.join(` ${buffer} `) : ''}
                     limit 1`
        let existResult = await dbService.commonQuery(existQuery,paramGroup)
        return existResult
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