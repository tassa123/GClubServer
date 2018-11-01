const RuleResult = require('../config/rule-result')
const {cStatus,cCmdType,cUserType,cOpType,cUserOp,cConferenceType} = require('../config/config')
const utilService = require('../service/util-service')
const dbService = require('../service/db-service')
const _ = require('lodash')
const moment = require('moment')
const smsService = require('../service/sms-service')
const appConfig = require('../../app');//引入配置文件

let UserInvitation=async(ctx)=>{
    let requestBody = ctx.request.body || {}
    let cmdType = (requestBody || {}).cmdType;
    let {op} = requestBody;
    if([cOpType.get,cOpType.set].indexOf(op) === -1){
        ctx.body = new RuleResult(cStatus.invalidParams,'','op');
        return
    }
    switch (op) {
        case cOpType.get:
            await InvitationGet(ctx)
            break;
        case cOpType.set:
            await InvitationSet(ctx)
            break;
    }
}

let SysInvitation=async(ctx)=>{
    let requestBody = ctx.request.body || {}
    let cmdType = (requestBody || {}).cmdType;
    let {op,conferenceId,userIdList} = requestBody;
    if([cOpType.create,cOpType.get,cOpType.set,cOpType.delete].indexOf(op) === -1){
        ctx.body = new RuleResult(cStatus.invalidParams,'','op');
        return
    }
    switch (op) {
        case cOpType.get:
            await InvitationGet(ctx)
            break;
        case cOpType.create:
            await InvitationCreate(ctx)
            break;
        case cOpType.delete:
            await InvitationDelete(ctx)
            break;
        case cOpType.set:
            await InvitationSet(ctx)
            break;
    }
}

let InvitationGet=async(ctx)=>{
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
    let userResult =await getItem(requestBody,countInfo)
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
let InvitationDelete=async(ctx)=>{
    let requestBody = ctx.request.body || {}
    let cmdType = (requestBody || {}).cmdType;
    let {id} = requestBody;
    let deleteQuery =  `delete from ref_user_conference_invitation  where id = ?`
    let deleteResult = await dbService.commonQuery(deleteQuery,[id])
    ctx.body = new RuleResult(cStatus.ok)
    return
}
let InvitationSet=async(ctx)=>{
    let requestBody = ctx.request.body || {}
    let cmdType = (requestBody || {}).cmdType;
    let {id,status} = requestBody;
    let columnGroup = []
    let paramGroup = []
    if([cStatus.denied,cStatus.acked,cStatus.finished].indexOf(status) > -1){
        columnGroup.push('status = ?')
        paramGroup.push(status)
    }
    paramGroup.push(id)
    let setQuery = `update ref_user_conference_invitation set ${columnGroup.join(',')} where id = ?`
    let setResult = await dbService.commonQuery(setQuery,paramGroup)
    ctx.body= new RuleResult(cStatus.ok)
    return
}
let InvitationCreate=async(ctx)=>{
    let requestBody = ctx.request.body || {}
    let cmdType = (requestBody || {}).cmdType;
    let {conferenceId,userIdList} = requestBody;
    // 删除重复的邀请
    let deleteQuery = `delete from ref_user_conference_invitation where conferenceId =? and userId in (?)`
    await dbService.commonQuery(deleteQuery,[conferenceId,userIdList])
    // 会议信息
    let conferenceDetailQuery = `select name from conference_info where id = ?`
    let conferenceDetailResult = await dbService.commonQuery(conferenceDetailQuery,[conferenceId])
    let conferenceDetail = (conferenceDetailResult[0] || {})
    // 用户信息
    let userListQuery = `select name,id,phone from user_info where id in(?)`
    let userListResult = await dbService.commonQuery(userListQuery,[userIdList])
    // 创建邀请
    let failPhone = []
    for(let user of userListResult){
        try {
            let createQuery = `insert into ref_user_conference_invitation(??)values(?)`
            let createResult = await dbService.commonQuery(createQuery,[['conferenceId','userId','status'],[conferenceId,user.id,cStatus.pending]])
            let insertId = createResult.insertId
            let smsConfig = {
                PhoneNumbers:user.phone,
                SignName:'理光中国会议系统',
                TemplateCode:appConfig.isProd ? 'SMS_147196697':'SMS_147201871',
                TemplateParam:JSON.stringify({
                    name:user.name,
                    name2:conferenceDetail.name,
                    itemId:insertId
                })
            }
            await smsService.SMS(smsConfig)
        }catch (e) {
            let deleteQuery = `delete from ref_user_conference_invitation where conferenceId = ? and userId = ?`
            await dbService.commonQuery(deleteQuery,[conferenceId,user.id])
            failPhone.push(user.phone)
        }
    }
    ctx.body= new RuleResult(failPhone.length>0 ? cStatus.fail:cStatus.ok,{failPhone})
    return
}

let getItem=async(params,countInfo)=>{
    let {id,skip,pageNum,filters,sorts,additions} = params;
    skip = skip || 0;
    filters = filters || {}
    sorts = sorts || []
    additions = additions || {}
    let {userId,phone,userName,email,company,activeTime,userType,
        conferenceId,conferenceId2,invitationStatus,userStatus,userAddress,userZone,
        customizedInfoStatus,interactionStatus,questionnaireStatus,questionnaireOpen} = filters;
    let {album3Len,userInfo,customizedInfoAnswer,interactionAnswer,questionnaireAnswer} = additions;
    let limit = pageNum || 10;
    let whereGroup = []
    let orderGroup = []
    let paramsGroup = []

    if(utilService.isStringEmpty(conferenceId) && utilService.isStringEmpty(conferenceId2)){
        whereGroup.push('(ci.status != ? or ci.status is null)')
        paramsGroup.push(cStatus.deleted)
    }

    if(!utilService.isStringEmpty(conferenceId)){
        whereGroup.push('ruci.conferenceId = ?')
        paramsGroup.push(conferenceId)
    }

    if(!utilService.isStringEmpty(conferenceId2)){
        whereGroup.push('ui.id not in (select userId from ref_user_conference_invitation where conferenceId = ?)')
        paramsGroup.push(conferenceId2)
    }

    if(!utilService.isArrayEmpty(invitationStatus)){
        whereGroup.push('ruci.status in (?)')
        paramsGroup.push(invitationStatus)
    }

    if(!utilService.isStringEmpty(id)){
        whereGroup.push('ruci.id = ?')
        paramsGroup.push(id)
        limit = 1
        skip = 0
    }
    if(!utilService.isStringEmpty(phone)){
        whereGroup.push('ui.phone like ?')
        paramsGroup.push(`%${phone}%`)
    }

    if(!utilService.isStringEmpty(userId)){
        whereGroup.push('ui.id = ? and ruci.id is not null and ci.id is not null')
        paramsGroup.push(userId)
    }


    if(!utilService.isStringEmpty(userName)){
        whereGroup.push('ui.name like ?')
        paramsGroup.push(`%${userName}%`)
    }

    if(!utilService.isStringEmpty(userZone)){
        whereGroup.push('ui.zone like ?')
        paramsGroup.push(`%${userZone}%`)
    }
    if(!utilService.isArrayEmpty(userAddress)){
        whereGroup.push("JSON_EXTRACT(ui.address, '$[0]') = ?")
        paramsGroup.push(userAddress[0])
    }

    if(!utilService.isStringEmpty(email)){
        whereGroup.push('ui.email like ?')
        paramsGroup.push(`%${email}%`)
    }
    if(!utilService.isStringEmpty(company)){
        whereGroup.push('ui.company like ?')
        paramsGroup.push(`%${company}%`)
    }
    if(!utilService.isArrayEmpty(userStatus)){
        whereGroup.push('ui.status in (?)')
        paramsGroup.push(userStatus)
    }
    if(!utilService.isArrayEmpty(userType)){
        whereGroup.push('ui.type in (?)')
        paramsGroup.push(userType)
    }
    if(!utilService.isStringEmpty((activeTime||[])[0])){
        whereGroup.push('ui.activeTime > ?')
        paramsGroup.push((activeTime||[])[0])
    }
    if(!utilService.isStringEmpty((activeTime||[])[1])){
        whereGroup.push('ui.activeTime < ?')
        paramsGroup.push((activeTime||[])[1])
    }
    if(!utilService.isArrayEmpty(interactionStatus)){
        whereGroup.push(
            `(case when ci.interaction is null then -1
				  when ci.interaction is not null and ruca2.answer is null then 0
                  when ci.interaction is not null and ruca2.answer is not null then 1
                  else 2 END)
             in (?)`
        )
        paramsGroup.push(interactionStatus)
    }
    if(!utilService.isArrayEmpty(customizedInfoStatus)){
        whereGroup.push(
            `(case when ci.customizedInfo is null then -1
				  when ci.customizedInfo is not null and ruca1.answer is null then 0
                  when ci.customizedInfo is not null and ruca1.answer is not null then 1
                  else 2 END)
             in (?)`
        )
        paramsGroup.push(customizedInfoStatus)
    }
    if(!utilService.isArrayEmpty(questionnaireStatus)){
        whereGroup.push(
            `(case when ci.questionnaire is null then -1
                      when ci.questionnaire is not null and ruca3.answer is null then 0
                      when ci.questionnaire is not null and ruca3.answer is not null then 1
                      else 2 END)
             in (?)`
        )
        paramsGroup.push(questionnaireStatus)
    }

    if(!utilService.isArrayEmpty(questionnaireOpen)){
        whereGroup.push(`ci.questionnaireStatus in (?)`)
        paramsGroup.push(questionnaireOpen)
    }

    orderGroup.unshift('ci.createTime desc')
    orderGroup.unshift('convert(ui.name using gbk) asc')
    for(let sort of sorts){
        if(Array.isArray(sort) && (sort[1] === -1 || sort[1] === 1) && ['status'].indexOf(sort[0]) > -1){
            if('status' === sort[0]){
                orderGroup.unshift(
                    `case when ruci.status = '${cStatus.pending}' then 0
                          when ruci.status = '${cStatus.acked}' then 1
                          when ruci.status = '${cStatus.finished}' then 2
                          when ruci.status = '${cStatus.denied}' then 3
                          else -1 end 
                 ${sort[1]>-1 ? 'asc' : 'desc'}`)
            }else {
                orderGroup.unshift(`ui.${sort[0]} ${sort[1]>-1 ? 'asc' : 'desc'}`)
            }
        }
    }
    let detailQuery =
        `select SQL_CALC_FOUND_ROWS
            ui.id as userId,
            ui.type as userType,
            ui.status as userStatus,
            ui.createTime as userCreateTime,
            ui.name as userName,
            ui.email as userEmail,
            ui.phone as userPhone,
            ui.company as userCompany,
            ui.address as userAddress,
            ui.zone as userZone,
            ui.activeTime as userActiveTime,
            ${userInfo?
            `ui.birthday as userBirthday,
             ui.sex as userSex,
             ui.height as userHeight,
             ui.weight as userWeight,
            `:''
            }
            ruci.id as id,
            ruci.conferenceId as conferenceId,
            ruci.status as status,
            ruci.createTime as cTime,
            ruci.updateTime as updateTime,
             ${!utilService.isArrayEmpty(customizedInfoStatus) ?
            `(case when ci.customizedInfo is null then -1
				  when ci.customizedInfo is not null and ruca1.answer is null then 0
                  when ci.customizedInfo is not null and ruca1.answer is not null then 1
                  else 2 END)as customizedInfoStatus,`:''
            }
            ${customizedInfoAnswer ? 'ruca1.answer as customizedInfoAnswer,':''}
             ${!utilService.isArrayEmpty(interactionStatus) ?
            `(case when ci.interaction is null then -1
				  when ci.interaction is not null and ruca2.answer is null then 0
                  when ci.interaction is not null and ruca2.answer is not null then 1
                  else 2 END)as interactionStatus,` :''
            }
               ${interactionAnswer ? 'ruca2.answer as interactionAnswer,':''}
              ${!utilService.isArrayEmpty(questionnaireStatus) ?
                `(case when ci.questionnaire is null then -1
                      when ci.questionnaire is not null and ruca3.answer is null then 0
                      when ci.questionnaire is not null and ruca3.answer is not null then 1
                      else 2 END)as questionnaireStatus,` : ''
                }
                      ${questionnaireAnswer ? 'ruca3.answer as questionnaireAnswer,':''}
                ${album3Len ? 'JSON_LENGTH(ci.album3) as album3Len,':''}
                ci.id as conferenceId,
                ci.album1 as album1,
                ci.signStatus as signStatus,
                  ci.questionnaireStatus as questionnaireOpen,
                ci.sTime as sTime,
                ci.eTime as eTime,
                ci.name as conferenceName
                from ref_user_conference_invitation as ruci 
                right join user_info as ui
                on ui.id = ruci.userId
                left join conference_info as ci
                on ruci.conferenceId = ci.id
            ${!utilService.isArrayEmpty(customizedInfoStatus) ? 
            ` left join ref_user_conference_answer as ruca1
            on ruca1.userId = ruci.userId and ruca1.conferenceId = ruci.conferenceId and ruca1.type = 'customizedInfo'` : ''
            }
             ${!utilService.isArrayEmpty(interactionStatus) ?
            `left join ref_user_conference_answer as ruca2
            on ruca2.userId = ruci.userId and ruca2.conferenceId = ruci.conferenceId and ruca2.type = 'interaction'` : ''
            }
              ${!utilService.isArrayEmpty(questionnaireStatus) ?
            `left join ref_user_conference_answer as ruca3
            on ruca3.userId = ruci.userId and ruca3.conferenceId = ruci.conferenceId and ruca3.type = 'questionnaire'` : ''
            }
           `
    if(whereGroup.length > 0){
        detailQuery = `${detailQuery} where ${whereGroup.join(' and ')}`
    }
    if(conferenceId2){
        detailQuery = `${detailQuery} group by ui.id`
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
        let row = queryResult[index]
        let _row = {
            id:row.id,
            status:row.status,
            cTime:row.cTime,
            updateTime:row.updateTime,
            user:{
                id:row.userId,
                type:row.userType,
                status:row.userStatus,
                cTime:row.userCreateTime,
                name:row.userName,
                email: row.userEmail,
                phone:row.userPhone,
                company:row.userCompany,
                activeTime:row.userActiveTime,
                address:row.userAddress ? JSON.parse(row.userAddress):null,
                zone:row.userZone
            },
            conference:{
                id:row.conferenceId,
                name:row.conferenceName,
                signStatus:row.signStatus,
                questionnaireOpen:row.questionnaireOpen,
                album1:row.album1 ? JSON.parse(row.album1) : null,
                sTime:row.sTime,
                eTime:row.eTime
            }
        }
        if(!utilService.isArrayEmpty(customizedInfoStatus)){
            _row.conference.customizedInfoStatus = row.customizedInfoStatus
        }
        if(customizedInfoAnswer){
            _row.conference.customizedInfoAnswer = row.customizedInfoAnswer ? JSON.parse( row.customizedInfoAnswer):null
        }
        if(!utilService.isArrayEmpty(interactionStatus)){
            _row.conference.interactionStatus = row.interactionStatus
        }
        if(interactionAnswer){
            _row.conference.interactionAnswer = row.interactionAnswer ? JSON.parse(row.interactionAnswer) : null
        }
        if(!utilService.isArrayEmpty(questionnaireStatus)){
            _row.conference.questionnaireStatus = row.questionnaireStatus
        }
        if(questionnaireAnswer){
            _row.conference.questionnaireAnswer = row.questionnaireAnswer ? JSON.parse(row.questionnaireAnswer):null
        }
        if(album3Len){
            _row.conference.album3Len = row.album3Len
        }
        if(userInfo){
            _row.user.birthday = row.userBirthday
            _row.user.sex = row.userSex
            _row.user.height = row.userHeight
            _row.user.weight = row.userWeight
            _row.user.address = row.userAddress ? JSON.parse(row.userAddress):null
        }
        queryResult[index]=_row
    }
    if(!utilService.isNullOrUndefined(countInfo) && !utilService.isNullOrUndefined(countInfo.tnum)){
        countInfo.tnum = tnumResult[0].tnum
        countInfo.tpage = Math.ceil(tnumResult[0].tnum/limit)
        countInfo.hasMore = (skip+limit)<tnumResult[0].tnum
    }
    return queryResult
}

module.exports = {
    SysInvitation:SysInvitation,
    UserInvitation:UserInvitation
};