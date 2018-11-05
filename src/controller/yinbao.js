const appID = '38E72CCD5D2A1245EBDE37D4487D6EB4'
const appKey = '1102638789451188107'
const utilService = require('./../service/util-service')
const moment = require('moment')
const md5 =  require('md5');
const crypto = require('crypto');
const https = require("https");


class YinBao{
    constructor(){

    }
    async getSignature(ctx){
        let requestBody = ctx.request.body || {}
        let JSONstr = JSON.stringify(requestBody)
        let strFinal = `${appKey.trim()}${JSONstr.trim()}`
        let body = {
            'time-stamp':(new Date()).getTime(),
            'data-signature':crypto.createHash('md5').update(strFinal).digest("hex").toUpperCase()
        }
        ctx.body = body;
    }

    async test(ctx){
        let JSONstr = JSON.stringify({
            "appId":"38E72CCD5D2A1245EBDE37D4487D6EB4",
            "startTime": "2018-11-04 01:59:59",
            "endTime": "2018-11-04 23:59:59",
        })
        let strFinal = `${appKey.trim()}${JSONstr.trim()}`
        let options = {
            host: "area12-win.pospal.cn",
            path: `/pospal-api2/openapi/v1/ticketOpenApi/queryTicketPages`,
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
        let result = await request
        ctx.body = result
        return
    }
}

module.exports = new YinBao();