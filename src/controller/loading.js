const RuleResult = require('../config/rule-result')
const {cStatus,cCmdType,cUserType,cOpType,cUserOp,cConferenceType} = require('../config/config')
const utilService = require('../service/util-service')
const dbService = require('../service/db-service')
const _ = require('lodash')
const moment = require('moment')

let SysLoading=async(ctx)=>{
    let requestBody = ctx.request.body || {}
    let cmdType = (requestBody || {}).cmdType;
    let {op} = requestBody;
    if([cOpType.create,cOpType.get,cOpType.delete,cOpType.set].indexOf(op) === -1){
        ctx.body = new RuleResult(cStatus.invalidParams,'','op');
        return
    }
    switch (op) {
        case cOpType.get:
            await LoadingGet(ctx)
            break;
        case cOpType.create:
            await LoadingCreate(ctx)
            break;
        case cOpType.delete:
            await LoadingDelete(ctx)
            break;
        case cOpType.set:
            await LoadingSet(ctx)
            break;
    }
}

let LoadingGet=async(ctx)=>{
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
let LoadingDelete=async(ctx)=>{
    let requestBody = ctx.request.body || {}
    let cmdType = (requestBody || {}).cmdType;
    let {id} = requestBody;
    let deleteQuery =  `delete from loading_info  where id = ?`
    let deleteResult = await dbService.commonQuery(deleteQuery,[id])
    ctx.body = new RuleResult(cStatus.ok)
    return
}
let LoadingCreate=async(ctx)=>{
    let requestBody = ctx.request.body || {}
    let cmdType = (requestBody || {}).cmdType;
    let {src,weight} = requestBody;
    if(utilService.isNullOrUndefined(src)){
        ctx.body= new RuleResult(cStatus.invalidParams,{},'src')
        return
    }

    // 创建loading
    let params = [['src','weight'],[src,weight]]
    let createQuery = `insert into loading_info(??)values(?)`
    let cerateResult = await dbService.commonQuery(createQuery,params)
    ctx.body= new RuleResult(cStatus.ok,{id:cerateResult.insertId})
    return
}
let LoadingSet=async(ctx)=>{
    let requestBody = ctx.request.body || {}
    let cmdType = (requestBody || {}).cmdType;
    let {id,weight} = requestBody;
    if(utilService.isStringEmpty(id) || utilService.isStringEmpty(weight)){
        ctx.body = new RuleResult(cStatus.invalidParams)
        return
    }
    let updateQuery =  `update loading_info set weight = ? where id = ?`
    let updateResult = await dbService.commonQuery(updateQuery,[weight,id])
    ctx.body = new RuleResult(cStatus.ok)
    return
}

let getItem=async(params,countInfo)=>{
    let {id,skip,pageNum,filters,sorts,additions} = params;
    skip = skip || 0;
    filters = filters || {}
    sorts = sorts || []
    additions = additions || {}
    let limit = pageNum||10;
    let whereGroup = []
    let orderGroup = []
    let paramsGroup = []

    orderGroup.unshift('weight asc')
    let detailQuery =
        `select SQL_CALC_FOUND_ROWS
            id,
            src,
            weight,
            createTime as cTime
            from loading_info
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
    if(!utilService.isNullOrUndefined(countInfo) && !utilService.isNullOrUndefined(countInfo.tnum)){
        countInfo.tnum = tnumResult[0].tnum
        countInfo.tpage = Math.ceil(tnumResult[0].tnum/limit)
        countInfo.hasMore = (skip+limit)<tnumResult[0].tnum
    }
    return queryResult
}

module.exports = {
    SysLoading:SysLoading
};