const RuleResult = require('../config/rule-result')
const {cStatus,cCmdType,cUserType,cOpType,cUserOp} = require('../config/config')
const utilService = require('../service/util-service')
const dbService = require('../service/db-service')
const _ = require('lodash')
const moment = require('moment')
const redisService = require('../service/redis-service')
const levelConfig = [
    {
        scoreSpan:[0,1999],
        title:'普通会员',
        rate:1.0
    },
    {
        scoreSpan:[2000,4999],
        title:'白银会员',
        rate:1.1
    },
    {
        scoreSpan:[5000,19999],
        title:'白金会员',
        rate:1.2
    },
    {
        scoreSpan:[20000,null],
        title:'白金会员',
        rate:1.3
    }
]

class User {
    constructor(){

    }

    getScoreInfo(totalScore = 0) {
        for(let level of levelConfig){
            let min = level.scoreSpan[0]
            let max = level.scoreSpan[1]
            if(min && max){
                if(totalScore>=min && totalScore<=max){
                    return {
                        title:level.title,
                        rate:level.rate
                    }
                }
            }
            if(!min && max){
                if(totalScore<=max){
                    return {
                        title:level.title,
                        rate:level.rate
                    }
                }
            }
            if(min && !max){
                if(totalScore>=min){
                    return {
                        title:level.title,
                        rate:level.rate
                    }
                }
            }
        }
    }

    // 用户积分处理
    async userScore({id,score,symbol=1}){
        if(utilService.isStringEmpty(id) ||
            utilService.isStringEmpty(score)
        ){
            return
        }
        let originLevel;
        let curLevel;
        score = Math.abs(score)
        if(score<1){
            return
        }
        let paramGroup = []
        let valueGroup = []
        if(symbol > 0){
            paramGroup.push('totalScore = (totalScore+?)')
            valueGroup.push(score)
            paramGroup.push('score = (score+?)')
            valueGroup.push(score)
            // 获取上一等级
            let userResult = await this.getItem({id:id})
            let userDetail = userResult[0]
            originLevel = userDetail.level
            let scoreInfo = this.getScoreInfo(userDetail.totalScore + score)
            curLevel = scoreInfo.title
        }else {
            paramGroup.push('score = (score-?)')
            valueGroup.push(score)
        }
        valueGroup.push(id)
        let scoreQuery = `update user_info set ${paramGroup.join(',')} where id = ?`
        await dbService.commonQuery(scoreQuery,valueGroup)
        // todo 微信推送积分变动

        // 处理升级
        if(symbol>0){
            if(originLevel !== curLevel){
                //todo 微信推送等级升级
            }
        }
    }
    async sysLogin(requestBody){
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
            return new RuleResult(cStatus.ok,detail);
        }else {
            return new RuleResult(cStatus.notExists);
        }
    }
    async sysUser(requestBody){
        let {op} = requestBody;
        if([cOpType.create,cOpType.get,cOpType.set,cOpType.delete].indexOf(op) === -1){
            ctx.body = new RuleResult(cStatus.invalidParams);
            return
        }
        switch (op) {
            case cOpType.get:
                return await this.itemGet(requestBody)
            case cOpType.create:
                return await this.itemCreate(requestBody)
            // case cOpType.delete:
            //    await itemDelete(ctx)
            //     break;
            case cOpType.set:
                return await this.itemSet(requestBody)
        }
    }
    async itemGet(requestBody={}){
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
    async itemCreate(requestBody={}){
        let {op, name, phone, accountName, wxAccountName, password, type, status, openid, birthday, sex, headPic, activeTime} = requestBody;
        let existResult = await this.itemExists({_buffer:'or',phone,accountName,wxAccountName,openid})
        if(existResult.length>0){
            let userDetail = existResult[0]
            return new RuleResult(cStatus.existing,{id:userDetail.id})
        }else {
            // create
            let uuid = utilService.getUUID();
            let insertQuery = `insert into user_info
        (id,name, phone, accountName, wxAccountName, password, type, status, openid, birthday, sex, headPic, activeTime)
        values(?,?,?,?,?,?,?,?,?,?,?,?,?)`
            let insertResult = await dbService.commonQuery(insertQuery,[uuid,name,phone,accountName,wxAccountName,password,type,status,openid,birthday?utilService.getTimeStamp(birthday):null,sex,headPic,activeTime ? utilService.getTimeStamp(activeTime):null])
            return new RuleResult(cStatus.ok,{id:uuid})
        }
    }
    async itemSet(requestBody){
        let {id, name, accountName, wxAccountName, password, status, openid, birthday, sex, headPic, activeTime} = requestBody;
        let existResult =await this.itemExists({_buffer:'or',id})
        if(existResult.length === 0){
            return new RuleResult(cStatus.notExists,{},'用户不存在')
        }

        let columnGroup = []
        let paramGroup = []
        if(!utilService.isStringEmpty(name)){
            columnGroup.push('name = ?')
            paramGroup.push(name)
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
       return new RuleResult(cStatus.ok)
    }
    async itemExists({_buffer,id,ybId,phone,accountName,wxAccountName,openid,...others},_whereGroup,_paramGroup){
        _whereGroup = _whereGroup || []
        let whereGroup = [];
        let paramGroup = _paramGroup || [];
        let buffer = _buffer || 'and'
        if(!utilService.isStringEmpty(id)){
            whereGroup.push('id = ?')
            paramGroup.push(id)
        }
        if(!utilService.isStringEmpty(ybId)){
            whereGroup.push('ybId = ?')
            paramGroup.push(ybId)
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
                         ybId,
                         ybNumber,
                         name,                      
                         phone,             
                         score,
                         accountName,
                         wxAccountName,
                         password,
                         type,
                         status,
                         openid,
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
        let {name, phone,totalScore, score, accountName, wxAccountName, type, status, openid, birthday, sex, headPic, ctime, activeTime} = filters;
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
        if(!utilService.isStringEmpty((totalScore||[])[0])){
            whereGroup.push('ui.totalScore >= ?')
            paramsGroup.push((totalScore||[])[0])
        }
        if(!utilService.isStringEmpty((totalScore||[])[1])){
            whereGroup.push('ui.totalScore <= ?')
            paramsGroup.push((totalScore||[])[1])
        }
        if(!utilService.isStringEmpty((ctime||[])[0])){
            whereGroup.push('ui.ctime >= ?')
            paramsGroup.push((ctime||[])[0])
        }
        if(!utilService.isStringEmpty((ctime||[])[1])){
            whereGroup.push('ui.ctime <= ?')
            paramsGroup.push((ctime||[])[1])
        }
        if(!utilService.isStringEmpty((activeTime||[])[0])){
            whereGroup.push('ui.activeTime >= ?')
            paramsGroup.push((activeTime||[])[0])
        }
        if(!utilService.isStringEmpty((activeTime||[])[1])){
            whereGroup.push('ui.activeTime <= ?')
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
                    ui.name as name,
                    ui.phone as phone,
                    ui.totalScore as totalScore,           
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

        for(let row of queryResult){
            if([cUserType.sys,cUserType.admin].indexOf(row.type) > -1){
                delete  row.score;
                delete  row.totalScore;
                delete  row.openid;
                delete  row.wxAccountName;
                delete  row.phone;
            }else {
                row.score = parseInt(row.score || 0)
                row.totalScore = parseInt(row.totalScore || 0)
                let scoreInfo = this.getScoreInfo(row.totalScore)
                row.level = scoreInfo.title;
                row.rate = scoreInfo.rate;
            }
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



module.exports = new User();