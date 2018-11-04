const RuleResult = require('../../config/rule-result')
const {cStatus,cCmdType,cUserType,cOpType,cUserOp,cConferenceType} = require('../../config/config')
const utilService = require('../../service/util-service')
const dbService = require('../../service/db-service')
const _ = require('lodash')
const moment = require('moment')

let UserAnswer=async(ctx)=>{
    let requestBody = ctx.request.body || {}
    let cmdType = (requestBody || {}).cmdType;
    let {op} = requestBody;
    if([cOpType.create,cOpType.get,cOpType.set,cOpType.delete].indexOf(op) === -1){
        ctx.body = new RuleResult(cStatus.invalidParams,'','op');
        return
    }
    switch (op) {
        case cOpType.get:
            await AnswerGet(ctx)
            break;
        case cOpType.create:
            await AnswerCreate(ctx)
            break;
        case cOpType.delete:
            await AnswerDelete(ctx)
            break;
        case cOpType.set:
            await AnswerSet(ctx)
            break;
    }
}

let SysAnswer=async(ctx)=>{
    let requestBody = ctx.request.body || {}
    let cmdType = (requestBody || {}).cmdType;
    let {op} = requestBody;
    if([cOpType.create,cOpType.get,cOpType.set,cOpType.delete].indexOf(op) === -1){
        ctx.body = new RuleResult(cStatus.invalidParams,'','op');
        return
    }
    switch (op) {
        case cOpType.get:
            await AnswerGet(ctx)
            break;
        case cOpType.create:
            await AnswerCreate(ctx)
            break;
        case cOpType.delete:
            await AnswerDelete(ctx)
            break;
        case cOpType.set:
            await AnswerSet(ctx)
            break;
    }
}

let AnswerGet=async(ctx)=>{
    let requestBody = ctx.request.body || {}
    let cmdType = (requestBody || {}).cmdType;
    let {op,id,pageNum} = requestBody;
    let ruleResult = new RuleResult()
    let countInfo ={
        tnum:0,
        tpage:0,
        hasMore:true,
        pageNum:pageNum||10
    }
    let getResult =await getItem(requestBody,countInfo)
    if(!utilService.isStringEmpty(id)){
        if(0 === getResult.length){
            ruleResult.setSt(cStatus.notExists)
        }else {
            ruleResult.setData(getResult[0])
        }
    }else {
        ruleResult.setData(getResult)
        ruleResult['tnum'] = countInfo.tnum
        ruleResult['tpage'] = countInfo.tpage
        ruleResult['pageNum'] = countInfo.pageNum
        ruleResult.setSt(countInfo.hasMore ? cStatus.ok : cStatus.noMore)
    }
    ctx.body = ruleResult
}
let AnswerDelete=async(ctx)=>{
    let requestBody = ctx.request.body || {}
    let cmdType = (requestBody || {}).cmdType;
    let {id} = requestBody;
    let deleteQuery =  `delete from ref_user_conference_answer  where id = ?`
    let deleteResult = await dbService.commonQuery(deleteQuery,[id])
    ctx.body = new RuleResult(cStatus.ok)
    return
}
let AnswerSet=async(ctx)=>{
    ctx.body= new RuleResult(cStatus.ok)
    return
}
let AnswerCreate=async(ctx)=>{
    let requestBody = ctx.request.body || {}
    let cmdType = (requestBody || {}).cmdType;
    let {answer,userId,conferenceId,type} = requestBody;
    if(utilService.isNullOrUndefined(answer)){
        ctx.body= new RuleResult(cStatus.invalidParams,{},'answer')
        return
    }
    if(utilService.isNullOrUndefined(type)){
        ctx.body= new RuleResult(cStatus.invalidParams,{},'type')
        return
    }
    // 判断是否生成过
    let getQuery = `select id from ref_user_conference_answer where userId=? and conferenceId=? and type=?`
    let getResult = await dbService.commonQuery(getQuery,[userId,conferenceId,type])
    if(getResult.length > 0){
        let id = getResult[0].id;
        let updateQuery = `update ref_user_conference_answer set answer = ? where id =?`
        await dbService.commonQuery(updateQuery,[JSON.stringify(answer),id])
        ctx.body= new RuleResult(cStatus.ok,{id:id})
        return
    }
    // 创建答复
    let params = [['answer','conferenceId','userId','type'],[JSON.stringify(answer),conferenceId,userId,type]]
    let createQuery = `insert into ref_user_conference_answer(??)values(?)`
    let cerateResult = await dbService.commonQuery(createQuery,params)
    ctx.body= new RuleResult(cStatus.ok,{id:cerateResult.insertId})
    return
}

let getItem=async(params,countInfo)=>{
    let {id,skip,pageNum,filters,sorts,additions} = params;
    skip = skip || 0;
    filters = filters || {}
    sorts = sorts || []
    additions = additions || {}
    let {conferenceId,type,userId} = filters;
    let limit = pageNum||10;
    let whereGroup = []
    let orderGroup = []
    let paramsGroup = []

    if(!utilService.isStringEmpty(id)){
        whereGroup.push('ruca.id = ?')
        paramsGroup.push(id)
        limit = 1
        skip = 0
    }
    if(!utilService.isStringEmpty(conferenceId)){
        whereGroup.push('ruca.conferenceId = ?')
        paramsGroup.push(conferenceId)
    }
    if(!utilService.isArrayEmpty(type)){
        whereGroup.push('ruca.type in (?)')
        paramsGroup.push(type)
    }
    if(!utilService.isStringEmpty(userId)){
        whereGroup.push('ruca.userId = ?')
        paramsGroup.push(userId)
    }
    orderGroup.unshift('ruca.updateTime desc')
    let detailQuery =
        `select SQL_CALC_FOUND_ROWS
            ruca.id,
            ruca.answer,
            ruca.updateTime,
            ruca.conferenceId as conferenceId,
            ruca.type,
            ui.name,
            ui.phone,
            ui.company,
            ui.email,
            ui.id as userId
            from ref_user_conference_answer as ruca
            inner join user_info as ui on ruca.userId = ui.id
            `
    if(whereGroup.length > 0){
        detailQuery = `${detailQuery} where ${whereGroup.join(' and ')}`
    }
    if(orderGroup.length > 0){
        detailQuery = `${detailQuery} order by ${orderGroup.join(' , ')}`
    }
    if(limit){
        detailQuery = `${detailQuery} limit ${skip},${limit}`
    }
    let queryResult = await dbService.commonQuery(detailQuery,paramsGroup)
    let tnumResult = await dbService.commonQuery('SELECT found_rows() AS tnum;')
    for(let index in queryResult){
        if('pure' === countInfo){
            continue
        }
        let row = queryResult[index]
        queryResult[index] = {
            id:row.id,
            type:row.type,
            answer:row.answer ? JSON.parse(row.answer) : null,
            updateTime:row.updateTime,
            user:{
                id:row.userId,
                name:row.name,
                phone:row.phone,
                company:row.company,
                email:row.email
            },
            conference:{
                id:row.conferenceId
            }
        }
    }
    if(!utilService.isNullOrUndefined(countInfo) && !utilService.isNullOrUndefined(countInfo.tnum)){
        countInfo.tnum = tnumResult[0].tnum
        countInfo.tpage = Math.ceil(tnumResult[0].tnum/limit)
        countInfo.hasMore = (skip+limit)<tnumResult[0].tnum
    }
    return queryResult
}

module.exports = {
    SysAnswer:SysAnswer,
    UserAnswer:UserAnswer
};