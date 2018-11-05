const RuleResult = require('../config/rule-result')
const {cStatus,cCmdType,cUserType,cOpType,cUserOp} = require('../config/config')
const utilService = require('../service/util-service')
const dbService = require('../service/db-service')
const _ = require('lodash')
const moment = require('moment')
const redisService = require('../service/redis-service')

class User {
    constructor(){

    }

    async UserInfo(ctx){
        let ruleResult = new RuleResult()
        let params = ctx.request.query || {}
        let requestBody = ctx.request.body || {}
        let cmdType = (requestBody || {}).cmdType;
        let {op,id} = requestBody;
        if(utilService.isStringEmpty(op)){
            ctx.body = new RuleResult(cStatus.invalidParams,'','op');
            return
        }
        if(op === cOpType.get){
            let userResult = await getItem(requestBody)
            ctx.body = new RuleResult(0 === userResult.length ? cStatus.notExists : cStatus.ok,userResult[0]);
            return
        }
        if(op === cOpType.set){
            await this.itemSet(ctx)
            return
        }
    }
    async SysLogin(ctx){
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
    async UserLogin(ctx){
        let params = ctx.request.query || {}
        let requestBody = ctx.request.body || {}
        let cmdType = (requestBody || {}).cmdType;
        let {phone,id} = requestBody;
        if(utilService.isStringEmpty(id) && utilService.isStringEmpty(phone)){
            ctx.body = new RuleResult(cStatus.invalidParams);
            return
        }
        let existResult = await this.itemExists({_buffer:'and',phone,id},['type in (?)'],[[cUserType.user,cUserType.admin]])
        if(existResult.length === 0){
            ctx.body = new RuleResult(cStatus.notExists,'','此用户不在理光系统中');
            return
        }
        let userDetail = existResult[0] || {}
        let userId = userDetail.id
        if(userDetail.status === cStatus.deleted){
            ctx.body = new RuleResult(cStatus.deny,{id:userId},'此用户已被锁定');
            return
        }
        if(utilService.isStringEmpty(userDetail.activeTime)){
            let updateQuery = `update user_info set activeTime = CURRENT_TIMESTAMP where id = ?`
            await dbService.commonQuery(updateQuery,[userId])
        }
        if(userDetail.status === cStatus.unactivated){
            let updateQuery = `update user_info set status = ? where id = ?`
            await dbService.commonQuery(updateQuery,[cStatus.normal,userId])
        }
        let sid = utilService.getSID();
        await redisService.set(sid,userId)
        ctx.body = new RuleResult(cStatus.ok,{id:userId,sid:sid});
    }
    async SysUser(ctx){
        let params = ctx.request.query || {}
        let requestBody = ctx.request.body || {}
        let cmdType = (requestBody || {}).cmdType;
        let {op} = requestBody;
        if([cOpType.create,cOpType.get,cOpType.set,cOpType.delete].indexOf(op) === -1){
            ctx.body = new RuleResult(cStatus.invalidParams);
            return
        }
        switch (op) {
            case cOpType.get:
                await this.itemGet(ctx)
                break;
            case cOpType.create:
                await this.itemCreate(ctx)
                break;
            // case cOpType.delete:
            //    await itemDelete(ctx)
            //     break;
            case cOpType.set:
                await this.itemSet(ctx)
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
    async itemCreate(ctx,innerCall=false){
        let requestBody = innerCall ? ctx : ctx.request.body || {}
        let {op, name, phone, level=1, score=0, accountName, wxAccountName, password, type, status, openid, birthday, sex, headPic, activeTime} = requestBody;
        let existResult = await this.itemExists({_buffer:'or',phone,accountName,wxAccountName,openid})
        if(existResult.length>0){
            let userDetail = existResult[0]
            ctx.body = new RuleResult(cStatus.existing,{id:userDetail.id})
            return
        }else {
            // create
            let uuid = utilService.getUUID();
            let insertQuery = `insert into user_info
        (id,name, phone, level, score, accountName, wxAccountName, password, type, status, openid, birthday, sex, headPic, activeTime)
        values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
            let insertResult = await dbService.commonQuery(insertQuery,[uuid,name,phone,level,score,accountName,wxAccountName,password,type,status,openid,birthday?utilService.getTimeStamp(birthday):null,sex,headPic,activeTime ? utilService.getTimeStamp(activeTime):null])
            ctx.body = new RuleResult(cStatus.ok,{id:uuid})
            return uuid
        }
    }
    async itemDelete(ctx){
        let params = ctx.request.query || {}
        let requestBody = ctx.request.body || {}
        let cmdType = (requestBody || {}).cmdType;
        let {op,id} = requestBody;
        let deleteQuery =  `update user_info set status = ? where id = ?`
        let deleteResult = await dbService.commonQuery(deleteQuery,[cStatus.deleted,id])
        ctx.body = new RuleResult(cStatus.ok)
        return
    }
    async itemSet(ctx){
        let params = ctx.request.query || {}
        let requestBody = ctx.request.body || {}
        let cmdType = (requestBody || {}).cmdType;
        let {op,id, name, phone, level, score, accountName, wxAccountName, password, status, openid, birthday, sex, headPic, activeTime} = requestBody;
        let existResult =await this.itemExists({_buffer:'or',id})
        if(existResult.length === 0){
            ctx.body = new RuleResult(cStatus.notExists,{},'用户不存在')
            return
        }

        let columnGroup = []
        let paramGroup = []
        if(!utilService.isStringEmpty(name)){
            columnGroup.push('name = ?')
            paramGroup.push(name)
        }
        if(!utilService.isStringEmpty(level)){
            columnGroup.push('level = ?')
            paramGroup.push(level)
        }
        if(!utilService.isStringEmpty(status)){
            columnGroup.push('status = ?')
            paramGroup.push(status)
        }
        // if(!utilService.isStringEmpty(score)){
        //     columnGroup.push('score = ?')
        //     paramGroup.push(score)
        // }
        if(!utilService.isStringEmpty(accountName)){
            columnGroup.push('accountName = ?')
            paramGroup.push(accountName)
        }
        if(!utilService.isStringEmpty(wxAccountName)){
            columnGroup.push('wxAccountName = ?')
            paramGroup.push(wxAccountName)
        }
        if(!utilService.isStringEmpty(password)){
            columnGroup.push('password = ?')
            paramGroup.push(password)
        }
        if(!utilService.isStringEmpty(openid)){
            columnGroup.push('openid = ?')
            paramGroup.push(openid)
        }
        if(!utilService.isStringEmpty(birthday)){
            columnGroup.push('birthday = ? ')
            paramGroup.push(utilService.getTimeStamp(birthday))
        }
        if(!utilService.isStringEmpty(sex)){
            columnGroup.push('sex = ? ')
            paramGroup.push(sex)
        }
        if(!utilService.isStringEmpty(headPic)){
            columnGroup.push('headPic = ? ')
            paramGroup.push(headPic)
        }
        if(!utilService.isStringEmpty(activeTime)){
            columnGroup.push('activeTime = ?')
            paramGroup.push(utilService.getTimeStamp(activeTime))
        }

        paramGroup.push(id)
        let setQuery = `update user_info set ${columnGroup.join(',')} where id = ?`
        let setResult = await dbService.commonQuery(setQuery,paramGroup)
        ctx.body= new RuleResult(cStatus.ok)
        return
    }
    async itemExists({_buffer,id,phone,accountName,wxAccountName,openid,...others},_whereGroup,_paramGroup){
        _whereGroup = _whereGroup || []
        let whereGroup = [];
        let paramGroup = _paramGroup || [];
        let buffer = _buffer || 'and'
        if(!utilService.isStringEmpty(id)){
            whereGroup.push('id = ?')
            paramGroup.push(id)
        }
        if(!utilService.isStringEmpty(phone)){
            whereGroup.push('phone = ?')
            paramGroup.push(phone)
        }
        if(!utilService.isStringEmpty(accountName)){
            whereGroup.push('accountName = ?')
            paramGroup.push(accountName)
        }
        if(!utilService.isStringEmpty(wxAccountName)){
            whereGroup.push('wxAccountName = ?')
            paramGroup.push(wxAccountName)
        }

        if(!utilService.isStringEmpty(openid)){
            whereGroup.push('openid = ?')
            paramGroup.push(openid)
        }
        if(whereGroup.length>0){
            whereGroup[0] = `(${whereGroup[0]}`
            whereGroup[whereGroup.length-1] = `${whereGroup[whereGroup.length-1]})`
        }

        let existQuery = `select 
                         id,
                         del,
                         name,
                         phone,
                         level,
                         score,
                         accountName,
                         wxAccountName,
                         password,
                         type,
                         status,
                         openid,
                         birthday,
                         sex,
                         headPic,
                         ctime,
                         activeTime
                         from user_info 
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
        let {name, phone, level, score, accountName, wxAccountName, type, status, openid, birthday, sex, headPic, ctime, activeTime} = filters;
        let limit = pageNum || 10;
        let whereGroup = []
        let orderGroup = []
        let paramsGroup = []

        if(!utilService.isStringEmpty(id)){
            whereGroup.push('ui.id = ?')
            paramsGroup.push(id)
            limit = 1
            skip = 0
        }else {
            whereGroup.push('ui.del != 1')
            orderGroup.unshift('ui.ctime desc')
        }
        if(!utilService.isStringEmpty(name)){
            whereGroup.push('ui.name like ?')
            paramsGroup.push(`%${name}%`)
        }
        if(!utilService.isStringEmpty(phone)){
            whereGroup.push('ui.phone like ?')
            paramsGroup.push(`%${phone}%`)
        }
        if(!utilService.isStringEmpty(accountName)){
            whereGroup.push('ui.accountName like ?')
            paramsGroup.push(`%${accountName}%`)
        }
        if(!utilService.isStringEmpty(wxAccountName)){
            whereGroup.push('ui.wxAccountName = ?')
            paramsGroup.push(`${wxAccountName}`)
        }
        if(!utilService.isArrayEmpty(type)){
            whereGroup.push('ui.type in (?)')
            paramsGroup.push(type)
        }
        if(!utilService.isArrayEmpty(status)){
            whereGroup.push('ui.status in (?)')
            paramsGroup.push(status)
        }
        if(!utilService.isStringEmpty(openid)){
            whereGroup.push('ui.openid = ?')
            paramsGroup.push(`${openid}`)
        }
        if(!utilService.isStringEmpty(sex)){
            whereGroup.push('ui.sex = ?')
            paramsGroup.push(`${sex}`)
        }
        if(!utilService.isStringEmpty((ctime||[])[0])){
            whereGroup.push('ui.ctime > ?')
            paramsGroup.push((ctime||[])[0])
        }
        if(!utilService.isStringEmpty((ctime||[])[1])){
            whereGroup.push('ui.ctime < ?')
            paramsGroup.push((ctime||[])[1])
        }
        if(!utilService.isStringEmpty((activeTime||[])[0])){
            whereGroup.push('ui.activeTime > ?')
            paramsGroup.push((activeTime||[])[0])
        }
        if(!utilService.isStringEmpty((activeTime||[])[1])){
            whereGroup.push('ui.activeTime < ?')
            paramsGroup.push((activeTime||[])[1])
        }

        // orderGroup.unshift('convert(ui.name using gbk) asc')
        // for(let sort of sorts){
        //     if(Array.isArray(sort) && (sort[1] === -1 || sort[1] === 1) && ['phone'].indexOf(sort[0]) > -1){
        //         orderGroup.unshift(`ui.${sort[0]} ${sort[1]>-1 ? 'asc' : 'desc'}`)
        //     }
        // }
        let detailQuery =
            `select
                    ui.id as id,
                    ui.del as del,
                    ui.name as name,
                    ui.phone as phone,
                    ui.level as level,
                    ui.score as score,
                    ui.accountName as accountName,
                    ui.wxAccountName as wxAccountName,
                    ui.password as password,
                    ui.type as type,
                    ui.status as status,
                    ui.openid as openid,
                    ui.birthday as birthday,
                    ui.sex as sex,
                    ui.headPic as headPic,
                    ui.ctime as ctime,
                    ui.activeTime as activeTime
            from user_info as ui
           `
        let allQuery = `select
                    count(*) as tnum
            from user_info as ui
           `
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

        }
        if(!utilService.isNullOrUndefined(countInfo) && !utilService.isNullOrUndefined(countInfo.tnum)){
            countInfo.tnum = tnumResult[0].tnum
            countInfo.tpage = Math.ceil(tnumResult[0].tnum/limit)
            countInfo.hasMore = (skip+limit)<tnumResult[0].tnum
        }
        return queryResult
    }
}



module.exports = new User();