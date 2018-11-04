const RuleResult = require('../../config/rule-result')
const {cStatus,cCmdType,cUserType,cOpType,cUserOp,cConferenceType} = require('../../config/config')
const utilService = require('../../service/util-service')
const dbService = require('../../service/db-service')
const _ = require('lodash')
const moment = require('moment')
const smsService = require('../../service/sms-service')
let vcodePool = {}

let SysVcode=async(ctx)=>{
    let requestBody = ctx.request.body || {}
    let cmdType = (requestBody || {}).cmdType;
    let {phone} = requestBody;
    if(utilService.isStringEmpty(phone)){
        ctx.body = new RuleResult(cStatus.invalidParams,'','phone');
        return
    }
    // 是否已经有历史记录
    let record = vcodePool[phone]
    let vcode;
    if(record){
        let cTime = record.cTime;
        let diff = moment().diff(moment(cTime),'seconds')
        if(diff >= 30*60){
            vcode=getVcode();
            // 无效 更新vcode 和 cTime
            let newRecord = {
                vcode:vcode,
                cTime:utilService.getTimeStamp()
            }
            vcodePool[phone] = newRecord
        }else if(diff < 1 * 60){
            ctx.body = new RuleResult(cStatus.overflow,{},'操作过于频繁，请稍后')
            return
        } else {
            vcode = record.vcode
            // 有效 更新cTime
            let newRecord = {
                vcode:vcode,
                cTime:utilService.getTimeStamp()
            }
            vcodePool[phone] = newRecord
        }
    }else {
        vcode = getVcode();
        let newRecord = {
            vcode:vcode,
            cTime:utilService.getTimeStamp()
        }
        vcodePool[phone] = newRecord
    }
    let smsConfig = {
        PhoneNumbers:phone,
        SignName:'理光中国会议系统',
        TemplateCode:'SMS_145155674',
        TemplateParam:JSON.stringify({code:vcode})
    }
    await smsService.SMS(smsConfig)
    ctx.body = new RuleResult(cStatus.ok,{vcode},'')
    return
}

let getVcode=()=>{
    let vcode="";
    for(let i=0;i<4;i++){
        vcode+=Math.floor(Math.random()*10)
    }
    return vcode
}
module.exports = {
    SysVcode:SysVcode
};