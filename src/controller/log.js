const RuleResult = require('../config/rule-result')
const {cStatus,cCmdType,cUserType,cOpType,cUserOp} = require('../config/config')
const utilService = require('../service/util-service')
const dbService = require('../service/db-service')
const _ = require('lodash')
const moment = require('moment')
const redisService = require('../service/redis-service')

class Log {
    constructor(){

    }
    async sysLog(ctx,innerCall = false){
        let params =innerCall ? null : ctx.request.query || {}
        let requestBody =innerCall?ctx: ctx.request.body || {}
        let cmdType = (requestBody || {}).cmdType;
        let {op} = requestBody;
        switch (op) {
            case cOpType.get:
                await this.itemGet(ctx)
                break;
            case cOpType.create:
                await this.itemCreate(ctx)
                break;
            // case cOpType.delete:
            //     await this.itemDelete(ctx)
            //     break;
            // case cOpType.set:
            //     await this.itemSet(ctx)
            //     break;
            default:
                ctx.body =  new RuleResult(cStatus.invalidParams,'','op');
                break;
        }
    }
    async userLog(ctx){
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
    async itemCreate(ctx,innerCall = false){
        let requestBody =innerCall?ctx: ctx.request.body || {}
        let {op,userId, orderId,msg,score} = requestBody;
        // create
        let uuid =utilService.getUUID();
        let insertQuery = `insert into score_log(??) values(?)`
        let propGroup = []
        let valueGroup = []
        if(!utilService.isStringEmpty(userId)){
            propGroup.push('userId')
            valueGroup.push(userId)
        }
        if(!utilService.isStringEmpty(orderId)){
            propGroup.push('orderId')
            valueGroup.push(orderId)
        }
        if(!utilService.isStringEmpty(msg)){
            propGroup.push('msg')
            valueGroup.push(msg)
        }
        if(!utilService.isStringEmpty(score)){
            propGroup.push('score')
            valueGroup.push(score)
        }
        let insertResult = await dbService.commonQuery(insertQuery,[propGroup,valueGroup])
        ctx.body = new RuleResult(cStatus.ok,{id:uuid})
    }
    async itemDelete(ctx){
        let params = ctx.request.query || {}
        let requestBody = ctx.request.body || {}
        let cmdType = (requestBody || {}).cmdType;
        let {op,id} = requestBody;
        let deleteQuery =  `update goods_info set del = 1 where id = ?`
        let deleteResult = await dbService.commonQuery(deleteQuery,[id])
        ctx.body = new RuleResult(cStatus.ok)
        return
    }
    async itemSet(ctx){
        let params = ctx.request.query || {}
        let requestBody = ctx.request.body || {}
        let cmdType = (requestBody || {}).cmdType;
        let {op,id, amount,online,name,score,des,pic} = requestBody;
        let columnGroup = []
        let paramGroup = []
        if(!utilService.isStringEmpty(amount)){
            columnGroup.push('amount = ?')
            paramGroup.push(amount)
        }
        if(!utilService.isStringEmpty(online)){
            columnGroup.push('online = ?')
            paramGroup.push(online)
        }
        if(!utilService.isStringEmpty(name)){
            columnGroup.push('name = ?')
            paramGroup.push(name)
        }
        if(!utilService.isStringEmpty(score)){
            columnGroup.push('score = ?')
            paramGroup.push(score)
        }
        if(!utilService.isStringEmpty(des)){
            columnGroup.push('des = ?')
            paramGroup.push(des)
        }
        if(!utilService.isArrayEmpty(pic)){
            columnGroup.push('pic = ?')
            paramGroup.push(JSON.stringify(pic))
        }

        paramGroup.push(id)
        let setQuery = `update goods_info set ${columnGroup.join(',')} where id = ?`
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
                         from goods_info 
                    ${_whereGroup.length>0 ?'where '+ _whereGroup.join(` ${buffer} `) : ''}
                    ${_whereGroup.length === 0 && whereGroup.length > 0 ? 'where '+whereGroup.join(` ${buffer} `) : ''}
                    ${_whereGroup.length > 0 && whereGroup.length > 0 ? 'and '+whereGroup.join(` ${buffer} `) : ''}
                     limit 1`
        let existResult = await dbService.commonQuery(existQuery,paramGroup)
        return existResult
    }
    async getItem(params,countInfo){
        let {id,skip,pageNum,filters,sorts} = params;
        skip = skip || 0;
        filters = filters || {}
        sorts = sorts || []
        let {amount,online,name,score,ctime} = filters;
        let limit = pageNum || 10;
        let whereGroup = []
        let orderGroup = []
        let paramsGroup = []

        if(!utilService.isStringEmpty(id)){
            whereGroup.push('gi.id = ?')
            paramsGroup.push(id)
            limit = 1
            skip = 0
        }else {
            whereGroup.push('gi.del != 1')
            orderGroup.unshift('gi.ctime desc')
        }
        if(!utilService.isStringEmpty(name)){
            whereGroup.push('gi.name like ?')
            paramsGroup.push(`%${name}%`)
        }
        if(!utilService.isStringEmpty((amount||[])[0])){
            whereGroup.push('gi.amount >= ?')
            paramsGroup.push((amount||[])[0])
        }
        if(!utilService.isStringEmpty((amount||[])[1])){
            whereGroup.push('gi.amount <= ?')
            paramsGroup.push((amount||[])[1])
        }
        if(!utilService.isStringEmpty((score||[])[0])){
            whereGroup.push('gi.score >= ?')
            paramsGroup.push((score||[])[0])
        }
        if(!utilService.isStringEmpty((score||[])[1])){
            whereGroup.push('gi.score <= ?')
            paramsGroup.push((score||[])[1])
        }
        if(!utilService.isStringEmpty(online)){
            whereGroup.push('gi.online = ?')
            paramsGroup.push(online)
        }

        if(!utilService.isStringEmpty((ctime||[])[0])){
            whereGroup.push('gi.ctime >= ?')
            paramsGroup.push((ctime||[])[0])
        }
        if(!utilService.isStringEmpty((ctime||[])[1])){
            whereGroup.push('gi.ctime <= ?')
            paramsGroup.push((ctime||[])[1])
        }

        // orderGroup.unshift('convert(gi.name using gbk) asc')
        // for(let sort of sorts){
        //     if(Array.isArray(sort) && (sort[1] === -1 || sort[1] === 1) && ['phone'].indexOf(sort[0]) > -1){
        //         orderGroup.unshift(`gi.${sort[0]} ${sort[1]>-1 ? 'asc' : 'desc'}`)
        //     }
        // }
        let detailQuery =
            `select
                    gi.id as id,
                    gi.amount as amount,
                    gi.online as online,
                    gi.name as name,
                    gi.score as score,
                    gi.des as des,
                    gi.pic as pic,
                    gi.ctime as ctime
            from goods_info as gi
           `
        let allQuery = `select count(*) as tnum from goods_info as gi`
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

module.exports = new Log();