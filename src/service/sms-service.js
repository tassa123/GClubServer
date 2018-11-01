const _ = require('lodash')
const moment = require('moment')
const SMSClient = require('@alicloud/sms-sdk')
const accessKeyId = 'LTAIHSorcfKhGUTg'
const secretAccessKey = 'eTYZeYf3FrLrFX2iexYoN2YqTJEOzw'
let smsClient = new SMSClient({accessKeyId, secretAccessKey})

let SMS=async(config)=>{
    try {
        let smsResult = await smsClient.sendSMS(config)
        if(smsResult.Code === 'OK'){

        }else {
            console.log(smsResult)
            throw new Error('fail')
        }
    }catch (e) {
        console.log(e)
        throw ('fail')
    }
}



module.exports = {
    SMS:SMS
};