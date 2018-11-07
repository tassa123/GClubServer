const appID = '38E72CCD5D2A1245EBDE37D4487D6EB4'
const appKey = '1102638789451188107'
const utilService = require('./../service/util-service')
const moment = require('moment')
const md5 =  require('md5');
const crypto = require('crypto');
const https = require("https");
const http = require("http");


class YinBao{
    constructor(){

    }

    async commonRequest(body={},path){
        body.appId = appID;
        let JSONstr = JSON.stringify(body)
        let strFinal = `${appKey.trim()}${JSONstr.trim()}`
        let options = {
            host: "area12-win.pospal.cn",
            path: path,
            port: 443,
            method: "POST",
            headers: {
                "Content-Type": "application/json;charset=utf-8",
                "time-stamp":(new Date()).getTime()+"",
                'data-signature':crypto.createHash('md5').update(strFinal).digest("hex").toUpperCase(),
                "accept-encoding":"gzip,deflate",
                "User-Agent":"openApi"
            }
        };
        let request =  new Promise((resolve, reject) => {
            const req = https.request(options, response => {
                let result = "";
                // utf8 编码
                response.setEncoding("utf8");
                response.on("data", data => {
                    result = result + data;
                });
                response.on("end", () => {
                    try {
                        let res = JSON.parse(result)
                        resolve(res);
                    } catch (e) {
                        reject(e);
                    }
                });
            });
            req.on("error", (e)=> {
                console.log(e);
                reject(e);
            });
            req.write(JSONstr);
            req.end();
        });
        return await request
    }

    async getMemberByNum(ctx){
        ctx.body = await this.commonRequest({ customerNum:"member001"},'/pospal-api2/openapi/v1/customerOpenApi/queryByNumber')
        return
    }
    async getMemberByUID(ctx){
        ctx.body = await this.commonRequest(
            {
                customerUid: 592384817498735200
            },
            '/pospal-api2/openapi/v1/customerOpenApi/queryByUid'
        )
        return
    }
    async getMemberByTel(ctx){
        ctx.body = await this.commonRequest(
            {
                customerTel:'13122390160'
            },
            '/pospal-api2/openapi/v1/customerOpenapi/queryBytel'
        )
        return
    }
    async createMember(ctx){
        ctx.body = await this.commonRequest(
            {
                customerInfo:{
                    categoryName:'会员卡',
                    number:'member002',
                    name:'郑元元',
                    point:0,
                    discount:0,
                    balance:0,
                    phone:'13600673364',
                    enable:1
                }
            },
            '/pospal-api2/openapi/v1/customerOpenApi/add'
        )
    }
    async getMember(ctx){
        ctx.body = await this.commonRequest(
            {},
            '/pospal-api2/openapi/v1/customerOpenApi/queryCustomerPages'
        )
    }
    async getBill(ctx){
        ctx.body = await this.commonRequest(
            {
                "startTime":moment('2018-11-06 13:00:00').format('YYYY-MM-DD HH:mm:ss'),
                "endTime": moment('2018-11-06 20:00:00').format('YYYY-MM-DD HH:mm:ss')
            },
            '/pospal-api2/openapi/v1/ticketOpenApi/queryTicketPages'
        )
    }
    async getPushConfig(ctx){
        ctx.body = await this.commonRequest(
            {

            },
            '/pospal-api2/openapi/v1/openNotificationOpenApi/queryPushUrl'
        )
    }
    async setPushConfig(ctx){
        ctx.body = await this.commonRequest(
            {
                "pushUrl":"http://gc.r-m.top/push/yinbao"
            },
            '/pospal-api2/openapi/v1/openNotificationOpenApi/updatePushUrl'
        )
    }
}

module.exports = new YinBao();