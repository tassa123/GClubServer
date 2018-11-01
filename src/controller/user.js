const RuleResult = require('../config/rule-result')
const {cStatus,cCmdType,cUserType,cOpType,cUserOp} = require('../config/config')
const utilService = require('../service/util-service')
const dbService = require('../service/db-service')
const _ = require('lodash')
const moment = require('moment')
const redisService = require('../service/redis-service')

let UserInfo=async(ctx)=>{
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
        let userResult = await getUserInfo(requestBody)
        ctx.body = new RuleResult(0 === userResult.length ? cStatus.notExists : cStatus.ok,userResult[0]);
        return
    }
    if(op === cOpType.set){
        await UserSet(ctx)
        return
    }
}

let SysLogin=async(ctx)=>{
    let params = ctx.request.query || {}
    let requestBody = ctx.request.body || {}
    let cmdType = (requestBody || {}).cmdType;
    let {loginName,password} = requestBody;
    if(utilService.isStringEmpty(loginName) || utilService.isStringEmpty(password)){
        ctx.body = new RuleResult(cStatus.invalidParams);
        return
    }
    let loginQuery =
        `select id
        from user_info
        where type in (?) and (accountName = ? or phone = ? or email = ?)  and password = ?
        limit 1`
    let loginResult =await dbService.commonQuery(loginQuery,[[cUserType.sys,cUserType.admin],loginName,loginName,loginName,password])
    if(loginResult.length > 0){
        let id = loginResult[0].id;
        let detailResult = await getUserInfo({id})
        let detail = detailResult[0]
        let sid = utilService.getSID();
        await redisService.set(sid,id)
        detail.sid = sid
        ctx.body = new RuleResult(cStatus.ok,detail);
    }else {
        ctx.body = new RuleResult(cStatus.notExists);
    }
}

let UserLogin=async(ctx)=>{
    let params = ctx.request.query || {}
    let requestBody = ctx.request.body || {}
    let cmdType = (requestBody || {}).cmdType;
    let {withLogin,phone,id} = requestBody;
    if(utilService.isStringEmpty(id) && utilService.isStringEmpty(phone)){
        ctx.body = new RuleResult(cStatus.invalidParams);
        return
    }
    let existResult = await userExists({_buffer:'and',phone,id},['type in (?)'],[[cUserType.user,cUserType.admin]])
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
    if(withLogin){
        let loginQuery = `insert into user_op(??) values(?,?)`
        await dbService.commonQuery(loginQuery,[['userId','op'],userId,cUserOp.login])
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

let SysUser=async(ctx)=>{
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
            await UserGet(ctx)
            break;
        case cOpType.create:
            ctx.request.body._strict = 1;
        await UserCreate(ctx)
            break;
        case cOpType.delete:
           await UserDelete(ctx)
            break;
        case cOpType.set:
          await UserSet(ctx)
            break;
    }
}

let UserGet=async(ctx)=>{
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
    let userResult =await getUserInfo(requestBody,countInfo)
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
let UserCreate=async(ctx)=>{
    let params = ctx.request.query || {}
    let requestBody = ctx.request.body || {}
    let cmdType = (requestBody || {}).cmdType;
    let {op,id,status,name,accountName,phone,email,company,type,height,weight,password,address,birthday,sex,openid,zone,department,_strict} = requestBody;
    let existResult = await userExists({_buffer:'or',phone,email,accountName,id,openid})
    if(existResult.length>0){
        let userDetail = existResult[0]
        if(cStatus.deleted === userDetail.status){
            let recoverQuery = `update user_info set openid = ?,accountName = ?,status = ?,name = ?,phone = ?,email = ?,company = ?,type = ?,height = ?,weight = ?,password=?,address=?,birthday=?,sex=?,zone=?,department=?,createTime = CURRENT_TIMESTAMP,activeTime = null  where id = ?`
            let recoverResult = await dbService.commonQuery(recoverQuery,[openid,accountName,status,name,phone,email,company,type,height,weight,password,address?JSON.stringify(address):null,birthday,sex,zone,department?JSON.stringify(department):null,userDetail.id])
            ctx.body = new RuleResult(cStatus.ok,{id:userDetail.id})
            return
        }else {
            ctx.body = new RuleResult(cStatus.existing,{id:userDetail.id})
            return
        }
    }else {
        // create
        let uuid = utilService.getUUID();
        let insertQuery = `insert into user_info(id,status,name,phone,email,company,type,accountName,password,openid,zone,address,department)values(?,?,?,?,?,?,?,?,?,?,?,?,?)`
        let insertResult = await dbService.commonQuery(insertQuery,[uuid,status,name,phone,email,company,type,accountName,password,openid,zone,address?JSON.stringify(address):null,department?JSON.stringify(department):null])
        ctx.body = new RuleResult(cStatus.ok,{id:uuid})
        return
    }
}
let UserDelete=async(ctx)=>{
    let params = ctx.request.query || {}
    let requestBody = ctx.request.body || {}
    let cmdType = (requestBody || {}).cmdType;
    let {op,id} = requestBody;
    let deleteQuery =  `update user_info set status = ? where id = ?`
    let deleteResult = await dbService.commonQuery(deleteQuery,[cStatus.deleted,id])
    ctx.body = new RuleResult(cStatus.ok)
    return
}

let UserSet=async(ctx)=>{
    let params = ctx.request.query || {}
    let requestBody = ctx.request.body || {}
    let cmdType = (requestBody || {}).cmdType;
    let {op,id,accountName,password,name,phone,email,company,height,weight,address,birthday,sex,headPic,openid,zone,department} = requestBody;
    let existResult =await userExists({_buffer:'or',accountName,phone,email,openid},['id != ?'],[id])
    if(existResult.length > 0){
        let target = existResult[0]
        let info;
        if(accountName === target.accountName){
            info = '账户名'
        }
        if(phone === target.phone){
            info = '手机'
        }
        if(email === target.email){
            info = '邮箱'
        }
        ctx.body = new RuleResult(cStatus.existing,{id},info)
        return
    }
    let columnGroup = []
    let paramGroup = []

    if(!utilService.isStringEmpty(openid)){
        columnGroup.push('openid = ?')
        paramGroup.push(openid)
    }

    if(!utilService.isStringEmpty(accountName)){
        columnGroup.push('accountName = ?')
        paramGroup.push(accountName)
    }

    if(!utilService.isStringEmpty(password)){
        columnGroup.push('password = ?')
        paramGroup.push(password)
    }

    if(!utilService.isStringEmpty(name)){
        columnGroup.push('name = ?')
        paramGroup.push(name)
    }

    if(!utilService.isStringEmpty(phone)){
        columnGroup.push('phone = ?')
        paramGroup.push(phone)
    }
    if(!utilService.isStringEmpty(email)){
        columnGroup.push('email = ?')
        paramGroup.push(email)
    }
    if(!utilService.isStringEmpty(company)){
        columnGroup.push('company = ?')
        paramGroup.push(company)
    }
    if(!utilService.isStringEmpty(height)){
        columnGroup.push('height = ? ')
        paramGroup.push(height)
    }
    if(!utilService.isStringEmpty(weight)){
        columnGroup.push('weight = ? ')
        paramGroup.push(weight)
    }
    if(!utilService.isStringEmpty(zone)){
        columnGroup.push('zone = ? ')
        paramGroup.push(zone)
    }
    if(!utilService.isArrayEmpty(address)){
        columnGroup.push('address = ?')
        paramGroup.push(JSON.stringify(address))
    }
    if(!utilService.isArrayEmpty(department)){
        columnGroup.push('department = ?')
        paramGroup.push(JSON.stringify(department))
    }
    if(!utilService.isStringEmpty(birthday)){
        columnGroup.push('birthday = ?')
        paramGroup.push(moment(birthday).format('YYYY-MM-DD HH:mm:ss'))
    }
    if(!utilService.isStringEmpty(sex)){
        columnGroup.push('sex = ?')
        paramGroup.push(sex)
    }
    if(!utilService.isStringEmpty(headPic)){
        columnGroup.push('headPic = ?')
        paramGroup.push(headPic)
    }
    paramGroup.push(id)
    let setQuery = `update user_info set ${columnGroup.join(',')} where id = ?`
    let setResult = await dbService.commonQuery(setQuery,paramGroup)
    ctx.body= new RuleResult(cStatus.ok)
    return
}

let userExists=async({_buffer,id,accountName,phone,email,openid,creator,...others},_whereGroup,_paramGroup)=>{
    _whereGroup = _whereGroup || []
    let whereGroup = [];
    let paramGroup = _paramGroup || [];
    let buffer = _buffer || 'and'
    if(!utilService.isStringEmpty(phone)){
        whereGroup.push('phone = ?')
        paramGroup.push(phone)
    }
    if(!utilService.isStringEmpty(email)){
        whereGroup.push('email = ?')
        paramGroup.push(email)
    }
    if(!utilService.isStringEmpty(accountName)){
        whereGroup.push('accountName = ?')
        paramGroup.push(accountName)
    }
    if(!utilService.isStringEmpty(id)){
        whereGroup.push('id = ?')
        paramGroup.push(id)
    }
    if(!utilService.isStringEmpty(openid)){
        whereGroup.push('openid = ?')
        paramGroup.push(openid)
    }
    if(whereGroup.length>0){
        whereGroup[0] = `(${whereGroup[0]}`
        whereGroup[whereGroup.length-1] = `${whereGroup[whereGroup.length-1]})`
    }

    let existQuery = `select id,phone,email,name,accountName,openid,activeTime,status from user_info 
                    ${_whereGroup.length>0 ?'where '+ _whereGroup.join(` ${buffer} `) : ''}
                    ${_whereGroup.length === 0 && whereGroup.length > 0 ? 'where '+whereGroup.join(` ${buffer} `) : ''}
                    ${_whereGroup.length > 0 && whereGroup.length > 0 ? 'and '+whereGroup.join(` ${buffer} `) : ''}
                     limit 1`
    let existResult = await dbService.commonQuery(existQuery,paramGroup)
    return existResult
}

let getUserInfo=async(params,countInfo)=>{
    let {id,skip,pageNum,filters,sorts} = params;
    let userPhone = (params||{}).phone
    let userEmail = (params||{}).email
    skip = skip || 0;
    filters = filters || {}
    sorts = sorts || []
    let {phone,name,email,status,company,activeTime,type,accountName,zone,address,department} = filters;
    let limit = pageNum || 10;
    let whereGroup = []
    let orderGroup = []
    let paramsGroup = []

    whereGroup.push('ui.status != ?')
    paramsGroup.push(cStatus.deleted)

    if(!utilService.isStringEmpty(id)){
        whereGroup.push('ui.id = ?')
        paramsGroup.push(id)
        limit = 1
        skip = 0
    }
    if(!utilService.isStringEmpty(userPhone)){
        whereGroup.push('ui.phone = ?')
        paramsGroup.push(userPhone)
    }
    if(!utilService.isStringEmpty(zone)){
        whereGroup.push('ui.zone like ?')
        paramsGroup.push(`%${zone}%`)
    }
    if(!utilService.isStringEmpty(accountName)){
        whereGroup.push('ui.accountName like ?')
        paramsGroup.push(`%${accountName}%`)
    }
    if(!utilService.isArrayEmpty(address)){
        whereGroup.push("JSON_EXTRACT(ui.address, '$[0]') = ?")
        paramsGroup.push(address[0])
    }
    if(!utilService.isArrayEmpty(department)){
        whereGroup.push("JSON_EXTRACT(ui.department, '$[0]') = ?")
        paramsGroup.push(department[0])
    }
    if(!utilService.isStringEmpty(userEmail)){
        whereGroup.push('ui.email = ?')
        paramsGroup.push(userEmail)
    }
    if(!utilService.isStringEmpty(phone)){
        whereGroup.push('ui.phone like ?')
        paramsGroup.push(`%${phone}%`)
    }
    if(!utilService.isStringEmpty(name)){
        whereGroup.push('ui.name like ?')
        paramsGroup.push(`%${name}%`)
    }
    if(!utilService.isStringEmpty(email)){
        whereGroup.push('ui.email like ?')
        paramsGroup.push(`%${email}%`)
    }
    if(!utilService.isStringEmpty(company)){
        whereGroup.push('ui.company like ?')
        paramsGroup.push(`%${company}%`)
    }
    if(!utilService.isArrayEmpty(status)){
        whereGroup.push('ui.status in (?)')
        paramsGroup.push(status)
    }
    if(!utilService.isArrayEmpty(type)){
        whereGroup.push('ui.type in (?)')
        paramsGroup.push(type)
    }
    if(!utilService.isStringEmpty((activeTime||[])[0])){
        whereGroup.push('ui.activeTime > ?')
        paramsGroup.push((activeTime||[])[0])
    }
    if(!utilService.isStringEmpty((activeTime||[])[1])){
        whereGroup.push('ui.activeTime < ?')
        paramsGroup.push((activeTime||[])[1])
    }
    orderGroup.unshift('ui.createTime desc')
    orderGroup.unshift('convert(ui.name using gbk) asc')
    for(let sort of sorts){
        if(Array.isArray(sort) && (sort[1] === -1 || sort[1] === 1) && ['phone'].indexOf(sort[0]) > -1){
            orderGroup.unshift(`ui.${sort[0]} ${sort[1]>-1 ? 'asc' : 'desc'}`)
        }
    }
    let detailQuery =
        `select SQL_CALC_FOUND_ROWS
          ui.accountName as accountName,
            ui.openid as openid,
            ui.id as id,
            ui.type as type,
            ui.status as status,
            ui.createTime as createTime,
            ui.name as name,
            ui.email as email,
            ui.phone as phone,
            ui.company as company,
            ui.activeTime as activeTime,
            ui.height as height,
            ui.weight as weight,
            ui.zone as zone,
            ui.address as address,
            ui.department as department,
            ui.birthday as birthday,
            ui.sex as sex,
            ui.headPic as headPic,
            ui.password as password,
            uo.createTime as lastLoginTime
            from user_info as ui
            left join (SELECT * FROM user_op order by createTime desc limit 1) as uo 
            on uo.userId = ui.id`
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
        row.address = row.address ? JSON.parse(row.address) : null
        row.department = row.department ? JSON.parse(row.department) : null
    }
    if(!utilService.isNullOrUndefined(countInfo) && !utilService.isNullOrUndefined(countInfo.tnum)){
        countInfo.tnum = tnumResult[0].tnum
        countInfo.tpage = Math.ceil(tnumResult[0].tnum/limit)
        countInfo.hasMore = (skip+limit)<tnumResult[0].tnum
    }
    return queryResult
}

module.exports = {
    UserInfo:UserInfo,
    SysLogin:SysLogin,
    UserLogin:UserLogin,
    SysUser:SysUser
};