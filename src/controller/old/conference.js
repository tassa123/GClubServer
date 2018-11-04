const RuleResult = require('../../config/rule-result')
const {cStatus,cCmdType,cUserType,cOpType,cUserOp,cConferenceType,cAnswerType} = require('../../config/config')
const utilService = require('../../service/util-service')
const dbService = require('../../service/db-service')
const _ = require('lodash')
const moment = require('moment')
const smsService = require('../../service/sms-service')
const appConfig = require('../../../app');//引入配置文件

let UserConference=async(ctx)=>{
    let params = ctx.request.query || {}
    let requestBody = ctx.request.body || {}
    let cmdType = (requestBody || {}).cmdType;
    let {op} = requestBody;
    if([cOpType.get].indexOf(op) === -1){
        ctx.body = new RuleResult(cStatus.invalidParams,'','op');
        return
    }
    switch (op) {
        case cOpType.get:
            await ConferenceGet(ctx)
            break;
    }
}

let SysConference=async(ctx)=>{
    let params = ctx.request.query || {}
    let requestBody = ctx.request.body || {}
    let cmdType = (requestBody || {}).cmdType;
    let {op} = requestBody;
    if([cOpType.create,cOpType.get,cOpType.set,cOpType.delete,cOpType.sendQuestionnaire,cOpType.pushMsg].indexOf(op) === -1){
        ctx.body = new RuleResult(cStatus.invalidParams,'','op');
        return
    }
    switch (op) {
        case cOpType.get:
         await ConferenceGet(ctx)
            break;
        case cOpType.create:
            await ConferenceCreate(ctx)
            break;
        case cOpType.delete:
         await ConferenceDelete(ctx)
            break;
        case cOpType.set:
      await ConferenceSet(ctx)
            break;
        case cOpType.sendQuestionnaire:
            await ConferenceSendQuestionnaire(ctx)
            break;
        case cOpType.pushMsg:
            await ConferencePushMsg(ctx)
            break;
    }
}

let ConferenceGet=async(ctx)=>{
    let requestBody = ctx.request.body || {}
    let cmdType = (requestBody || {}).cmdType;
    let {op,id,pageNum,shortId} = requestBody;
    let ruleResult = new RuleResult()
    let countInfo ={
        tnum:0,
        tpage:0,
        hasMore:true,
        pageNum:pageNum||10
    }
    let getResult =await getItem(requestBody,countInfo)
    if(!utilService.isStringEmpty(id) || !utilService.isStringEmpty(shortId)){
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
let ConferenceCreate=async(ctx)=>{
    let requestBody = ctx.request.body || {}
    let cmdType = (requestBody || {}).cmdType;
    let {op,id,name,address,status,signStatus,type,album1,album2,album3,note,sTime,eTime,process,customizedInfo,interaction,questionnaire,department,userIdList} = requestBody;
    // 判断是否是已经被删除的会议
    let existResult = await conferenceExists({_buffer:'or',id,name})
    if(existResult.length>0){
        let conferenceDetail = existResult[0]
        if(cStatus.deleted === conferenceDetail.status){
            let recoverQuery = `
                    update conference_info set 
                    name = ?,
                    address = ?,
                    status = ?,
                    signStatus = ?,
                    type = ?,
                    album1 = ?,
                    album2 = ?,
                    album3 = ?,
                    note = ?,
                    sTime = ?,
                    eTime = ?,
                    process = ?,
                    customizedInfo = ?,
                    interaction = ?,
                    questionnaire = ?,
                    department = ?,
                    createTime = CURRENT_TIMESTAMP
                    where id = ?
                    `
            let recoverResult = await dbService.commonQuery(recoverQuery,
                [name,
                    address ? JSON.stringify(address):null,
                    cStatus.normal,
                    0,
                    type,
                    utilService.isArrayEmpty(album1) ? null : JSON.stringify(album1),
                    utilService.isArrayEmpty(album2) ? null : JSON.stringify(album2),
                    utilService.isArrayEmpty(album3) ? null : JSON.stringify(album3),
                    note,
                    sTime ? utilService.getTimeStamp(sTime) : null,
                    eTime ? utilService.getTimeStamp(eTime) : null,
                    process,
                    utilService.isNullOrUndefined(customizedInfo) ? null : JSON.stringify(customizedInfo),
                    utilService.isNullOrUndefined(interaction) ? null : JSON.stringify(interaction),
                    utilService.isNullOrUndefined(questionnaire) ? null : JSON.stringify(questionnaire),
                    department,
                    conferenceDetail.id
                ]
            )
            ctx.body = new RuleResult(cStatus.ok,{id:conferenceDetail.id})
            return
        }else {
            ctx.body = new RuleResult(cStatus.existing,{id:conferenceDetail.id})
            return
        }
    }else {
        // create
        let uuid = utilService.getUUID();
        let insertQuery = `insert into conference_info(id,name,address,status,signStatus,type,album1,album2,album3,note,sTime,eTime,process,customizedInfo,interaction,questionnaire,department)values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
        let insertResult = await dbService.commonQuery(insertQuery,
            [uuid,
                name,
                address ? JSON.stringify(address):null,
                cStatus.normal,
                0,
                type,
                utilService.isArrayEmpty(album1) ? null : JSON.stringify(album1),
                utilService.isArrayEmpty(album2) ? null : JSON.stringify(album2),
                utilService.isArrayEmpty(album3) ? null : JSON.stringify(album3),
                note,
                sTime ? utilService.getTimeStamp(sTime) : null,
                eTime ? utilService.getTimeStamp(eTime) : null,
                process,
                utilService.isNullOrUndefined(customizedInfo) ? null : JSON.stringify(customizedInfo),
                utilService.isNullOrUndefined(interaction) ? null : JSON.stringify(interaction),
                utilService.isNullOrUndefined(questionnaire) ? null : JSON.stringify(questionnaire),
                department
            ])
        ctx.body = new RuleResult(cStatus.ok,{id:uuid})
        return
    }
}

let ConferenceDelete=async(ctx)=>{
    let requestBody = ctx.request.body || {}
    let cmdType = (requestBody || {}).cmdType;
    let {op,id} = requestBody;
    let deleteQuery =  `update conference_info set status = ? where id = ?`
    let deleteResult = await dbService.commonQuery(deleteQuery,[cStatus.deleted,id])
    ctx.body = new RuleResult(cStatus.ok)
    return
}

let ConferenceSet=async(ctx)=>{
    let requestBody = ctx.request.body || {}
    let cmdType = (requestBody || {}).cmdType;
    let {op,id,name,address,status,signStatus,questionnaireOpen,type,album1,album2,album3,note,sTime,eTime,process,customizedInfo,interaction,questionnaire,userIdList} = requestBody;
    let columnGroup = []
    let paramGroup = []

    if(!utilService.isStringEmpty(name)){
        columnGroup.push('name = ?')
        paramGroup.push(name)
    }
    if(!utilService.isArrayEmpty(address)){
        columnGroup.push('address = ?')
        paramGroup.push(JSON.stringify(address))
    }
    if([0,1].indexOf(signStatus) > -1){
        columnGroup.push('signStatus = ?')
        paramGroup.push(signStatus)
    }
    if([0,1].indexOf(questionnaireOpen) > -1){
        columnGroup.push('questionnaireStatus = ?')
        paramGroup.push(questionnaireOpen)
    }
    if(!utilService.isNullOrUndefined(album1)){
        columnGroup.push('album1 = ?')
        paramGroup.push(JSON.stringify(album1))
    }
    if(!utilService.isNullOrUndefined(album2)){
        columnGroup.push('album2 = ?')
        paramGroup.push(JSON.stringify(album2))
    }
    if(!utilService.isNullOrUndefined(album3)){
        columnGroup.push('album3 = ?')
        paramGroup.push(JSON.stringify(album3))
    }
    if(!utilService.isNullOrUndefined(note)){
        columnGroup.push('note = ?')
        paramGroup.push(note)
    }
    if(!utilService.isNullOrUndefined(process)){
        columnGroup.push('process = ?')
        paramGroup.push(process)
    }
    if(!utilService.isStringEmpty(sTime)){
        columnGroup.push('sTime = ?')
        paramGroup.push(utilService.getTimeStamp(sTime))
    }
    if(!utilService.isStringEmpty(eTime)){
        columnGroup.push('eTime = ?')
        paramGroup.push(utilService.getTimeStamp(eTime))
    }
    if(!utilService.isNullOrUndefined(customizedInfo)){
        columnGroup.push('customizedInfo = ?')
        paramGroup.push(JSON.stringify(customizedInfo))
    }
    if(!utilService.isNullOrUndefined(questionnaire)){
        columnGroup.push('questionnaire = ?')
        paramGroup.push(JSON.stringify(questionnaire))
    }
    if(!utilService.isNullOrUndefined(interaction)){
        columnGroup.push('interaction = ?')
        paramGroup.push(JSON.stringify(interaction))
    }
    paramGroup.push(id)
    let setQuery = `update conference_info set ${columnGroup.join(',')} where id = ?`
    let setResult = await dbService.commonQuery(setQuery,paramGroup)
    ctx.body= new RuleResult(cStatus.ok)
    return
}
let ConferenceSendQuestionnaire=async(ctx)=>{
    let requestBody = ctx.request.body || {}
    let cmdType = (requestBody || {}).cmdType;
    let {op,id} = requestBody;
    // 找出所有接受邀请但未填写问卷的用户
    let selectQuery =
        `select 
        ui.id as userId,
        ui.phone as phone,
        ui.name as userName,
        ci.shortId as conferenceShortId,
        ci.name as conferenceName
        from ref_user_conference_invitation as ruci
         inner join user_info as ui on ui.id = ruci.userId
         left join conference_info as ci on ci.id = ruci.conferenceId
         where ruci.conferenceId = ? 
         and ruci.status in(?) 
         and ruci.userId not in (
            select userId from ref_user_conference_answer where conferenceId = ? and type = ?
         )
        `
    let selectResult = await dbService.commonQuery(selectQuery,[id,[cStatus.acked,cStatus.finished],id,cAnswerType.questionnaire])
    let failPhone = []
    for(let user of selectResult){
        let smsConfig = {
            PhoneNumbers:user.phone,
            SignName:'理光中国会议系统',
            TemplateCode:appConfig.isProd ? 'SMS_147196342':'SMS_145500225',
            TemplateParam:JSON.stringify({
                    name:user.userName,
                    name2:user.conferenceName,
                    itemId:user.conferenceShortId
                })
        }
        try {
            await smsService.SMS(smsConfig)
        }catch (e) {
            console.log(e)
            failPhone.push(user.phone)
        }
    }
    ctx.body = new RuleResult(failPhone.length > 0 ? cStatus.fail:cStatus.ok,{failPhone})
    return
}

let ConferencePushMsg=async(ctx)=>{
    let requestBody = ctx.request.body || {}
    let cmdType = (requestBody || {}).cmdType;
    let {userIdList,msgPush,conferenceId} = requestBody;
    let pushObj = {
        cTime:utilService.getISOTime(),
        msg:`请于${msgPush.time}及时前往${msgPush.location}${msgPush.event}`
    }
    // 用户信息
    let userListQuery = `select name,id,phone from user_info where id in(?)`
    let userListResult = await dbService.commonQuery(userListQuery,[userIdList])
    let failPhone = []
    for(let user of userListResult){
        let smsConfig = {
            PhoneNumbers:user.phone,
            SignName:'理光中国会议系统',
            TemplateCode:'SMS_145495660',
            TemplateParam:JSON.stringify({
                name:user.name,
                time:msgPush.time,
                location:`${msgPush.location}${msgPush.event}`
            })
        }
        try {
            await smsService.SMS(smsConfig)
        }catch (e) {
            failPhone.push(user.phone)
        }
    }
    let updateLogQuery =
        `update conference_info 
        set pushLog = JSON_ARRAY_INSERT(
        (case
            when JSON_LENGTH(pushLog) <= 0 then '[]'
            when JSON_LENGTH(pushLog) is null then '[]'
            else pushLog end), 
        '$[0]', CAST(? AS JSON))
         where id = ?`
    let updateLogResult = await dbService.commonQuery(updateLogQuery,[JSON.stringify(pushObj),conferenceId])
    ctx.body = new RuleResult(failPhone.length>0 ? cStatus.fail:cStatus.ok,{failPhone})
    return
}

let conferenceExists=async({_buffer,id,name,...others},_whereGroup,_paramGroup)=>{
    _whereGroup = _whereGroup || []
    let whereGroup = [];
    let paramGroup = _paramGroup || [];
    let buffer = _buffer || 'and'
    if(!utilService.isStringEmpty(name)){
        whereGroup.push('name = ?')
        paramGroup.push(name)
    }

    if(!utilService.isStringEmpty(id)){
        whereGroup.push('id = ?')
        paramGroup.push(id)
    }
    if(whereGroup.length>0){
        whereGroup[0] = `(${whereGroup[0]}`
        whereGroup[whereGroup.length-1] = `${whereGroup[whereGroup.length-1]})`
    }


    let existQuery = `select id,name,status from conference_info 
     ${_whereGroup.length > 0 ? 'where ' + _whereGroup.join(` ${buffer} `) : ''}
     ${_whereGroup.length === 0 && whereGroup.length > 0 ? 'where ' + whereGroup.join(` ${buffer} `) : ''}
     ${_whereGroup.length > 0 && whereGroup.length > 0 ? 'and ' + whereGroup.join(` ${buffer} `) : ''}
        limit 1`
    let existResult = await dbService.commonQuery(existQuery,paramGroup)
    return existResult
}

let getItem=async(params,countInfo)=>{
    let {id,skip,pageNum,filters,sorts,additions,shortId} = params;
    skip = skip || 0;
    filters = filters || {}
    sorts = sorts || []
    additions = additions || {}
    let {type,name,address,cTime,status,department} = filters;
    let {customizedInfo,customizedInfoNum,
        interaction,interactionNum,
        questionnaire,questionnaireNum,
        invitationNum,invitationAckedNum,
        signInNum, album3,album2,process,pushLog} = additions;
    let limit = pageNum||10;
    let whereGroup = []
    let orderGroup = []
    let paramsGroup = []

    if(!utilService.isStringEmpty(id)){
        whereGroup.push('ci.id = ?')
        paramsGroup.push(id)
        limit = 1
        skip = 0
    }
    if(!utilService.isStringEmpty(shortId)){
        whereGroup.push('ci.shortId = ?')
        paramsGroup.push(shortId)
        limit = 1
        skip = 0
    }
    if(!utilService.isStringEmpty(name)){
        whereGroup.push('ci.name like ?')
        paramsGroup.push(`%${name}%`)
    }
    if(!utilService.isArrayEmpty(type)){
        whereGroup.push('ci.type in(?)')
        paramsGroup.push(type)
    }
    if(!utilService.isStringEmpty(department)){
        whereGroup.push('ci.department =?')
        paramsGroup.push(department)
    }
    if(!utilService.isArrayEmpty(status)){
        whereGroup.push('ci.status in(?)')
        paramsGroup.push(status)
    }
    if(!utilService.isStringEmpty((cTime||[])[0])){
        whereGroup.push('ci.createTime > ?')
        paramsGroup.push((cTime||[])[0])
    }
    if(!utilService.isStringEmpty((cTime||[])[1])){
        whereGroup.push('ci.createTime < ?')
        paramsGroup.push((cTime||[])[1])
    }
    if(!utilService.isArrayEmpty(address)){
        whereGroup.push("JSON_EXTRACT(ci.address, '$[0]') = ?")
        paramsGroup.push(address[0])
        whereGroup.push("JSON_EXTRACT(ci.address, '$[1]') = ?")
        paramsGroup.push(address[1])
    }
    orderGroup.unshift('ci.createTime desc')
    for(let sort of sorts){
        if(Array.isArray(sort) && (sort[1] === -1 || sort[1] === 1) && ['invitationNum','invitationAckedNum','signInNum','customizedInfoNum','interactionNum','questionnaireNum'].indexOf(sort[0]) > -1){
            orderGroup.unshift(`${sort[0]} ${sort[1]>-1 ? 'asc' : 'desc'}`)
        }
    }
    let detailQuery =
        `select SQL_CALC_FOUND_ROWS
            ci.id,
            ci.name,
            ci.address,
            ci.status,
            ci.signStatus,
            ci.questionnaireStatus as questionnaireOpen,
            ci.type,
            ci.album1,
            ci.shortId,
          ${album2 ? 'ci.album2,':''}
            ${album3 ? 'ci.album3,':''}
            ci.note,
            ci.sTime,
            ci.eTime,
           ${process ? 'ci.process,':''}
              ${pushLog ? 'ci.pushLog,':''}
            ${customizedInfo ? 'ci.customizedInfo,' : ''}
            ${interaction ? 'ci.interaction,' : ''}
            ${questionnaire ? 'ci.questionnaire,' : ''}
            ${invitationNum ? 'ruci1.tnum as invitationNum,':''}
            ${invitationAckedNum ? 'ruci2.tnum as invitationAckedNum,':''}
            ${signInNum? 'ruci3.tnum as signInNum,':''}
            ${customizedInfoNum ? 'ruca1.tnum as customizedInfoNum,':''}
            ${interactionNum ? 'ruca2.tnum as interactionNum,':''}
            ${questionnaireNum ? 'ruca3.tnum as questionnaireNum,':''}
            ci.createTime as cTime
            from conference_info as ci
            ${invitationNum ? 
            `left join (
            select count(*) as tnum,max(ruci_t1.conferenceId) as conferenceId 
from ref_user_conference_invitation as ruci_t1
inner join user_info as ui_t1 on ruci_t1.userId = ui_t1.id
where ruci_t1.status in('denied','pending','acked','finished') and ui_t1.status != 'deleted' 
group by conferenceId
            ) as ruci1 on ci.id =ruci1.conferenceId`
            :''}
            ${invitationAckedNum ? 
            `left join (
            select count(*) as tnum,max(ruci_t2.conferenceId) as conferenceId 
from ref_user_conference_invitation as ruci_t2
inner join user_info as ui_t2 on ruci_t2.userId = ui_t2.id
where ruci_t2.status in('acked','finished')  and ui_t2.status != 'deleted'
group by conferenceId
            ) as ruci2 on ci.id =ruci2.conferenceId`
            :''}
            ${signInNum ? 
            `left join (
            select count(*) as tnum,max(ruci_t3.conferenceId) as conferenceId 
from ref_user_conference_invitation as ruci_t3
inner join user_info as ui_t3 on ruci_t3.userId = ui_t3.id
 where ruci_t3.status in('finished') and ui_t3.status != 'deleted'
 group by conferenceId
            ) as ruci3 on ci.id =ruci3.conferenceId`
            :''}       
            ${customizedInfoNum ? 
            `left join (
            select count(*) as tnum,max(ruca_t4.conferenceId) as conferenceId 
from ref_user_conference_answer as ruca_t4
inner join user_info as ui_t4
on ruca_t4.userId = ui_t4.id
where ruca_t4.type = 'customizedInfo'  and ui_t4.status != 'deleted'
group by conferenceId
            ) as ruca1 on ci.id =ruca1.conferenceId`
            :''}
            ${interactionNum ? 
            `left join (
            select count(*) as tnum,max(ruca_t5.conferenceId) as conferenceId 
from ref_user_conference_answer as ruca_t5
inner join user_info as ui_t5
on ruca_t5.userId = ui_t5.id
 where ruca_t5.type = 'interaction' and ui_t5.status != 'deleted'
 group by conferenceId
            ) as ruca2 on ci.id =ruca2.conferenceId`
            :''}
            ${questionnaireNum ? 
            `left join (
            select count(*) as tnum,max(ruca_t6.conferenceId) as conferenceId 
from ref_user_conference_answer  as ruca_t6
inner join user_info as ui_t6
on ruca_t6.userId = ui_t6.id
 where ruca_t6.type = 'questionnaire'  and ui_t6.status != 'deleted'
 group by conferenceId
            ) as ruca3 on ci.id =ruca3.conferenceId`
            :''}
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
    for(let row of queryResult){
        if('pure' === countInfo){
            continue
        }
        if(!utilService.isStringEmpty(row.address)){
            row.address = JSON.parse(row.address)
        }
        if(!utilService.isStringEmpty(row.album1)){
            row.album1 = JSON.parse(row.album1)
        }
        if(!utilService.isStringEmpty(row.album2)){
            row.album2 = JSON.parse(row.album2)
        }
        if(!utilService.isStringEmpty(row.album3)){
            row.album3 = JSON.parse(row.album3)
        }
        if(!utilService.isStringEmpty(row.customizedInfo)){
            row.customizedInfo = JSON.parse(row.customizedInfo)
        }
        if(!utilService.isStringEmpty(row.interaction)){
            row.interaction = JSON.parse(row.interaction)
        }
        if(!utilService.isStringEmpty(row.questionnaire)){
            row.questionnaire = JSON.parse(row.questionnaire)
        }
        if(!utilService.isStringEmpty(pushLog)){
            row.pushLog = JSON.parse(row.pushLog)
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
    SysConference:SysConference,
    UserConference:UserConference
};