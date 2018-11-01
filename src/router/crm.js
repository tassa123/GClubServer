const Router = require('koa-router')
const Log4js = require('koa-log4')
const logger = Log4js.getLogger('weixin');
const RuleResult = require('../config/rule-result')
const CrmRouter = new Router();
const queryString = require('query-string')
const appConfig = require('../../app');//引入配置文件

CrmRouter
    .post('/ticket', async(ctx) => {
        let params = ctx.request.query || {}
        let requestBody = ctx.request.body || {}
        console.log(requestBody)
    })
    .post('/bill', async(ctx) => {
        //1.获取微信服务器Get请求的参数 signature、timestamp、nonce、echostr
        let signature = ctx.request.query.signature,//微信加密签名
            timestamp = ctx.request.query.timestamp,//时间戳
            nonce = ctx.request.query.nonce,//随机数
            echostr = ctx.request.query.echostr;//随机字符串
        //2.将token、timestamp、nonce三个参数进行字典序排序
        let array = [Token,timestamp,nonce];
        array.sort();
        //3.将三个参数字符串拼接成一个字符串进行sha1加密
        let tempStr = array.join('');
        const hashCode = crypto.createHash('sha1'); //创建加密类型
        let resultCode = hashCode.update(tempStr,'utf8').digest('hex'); //对传入的字符串进行加密
        //4.开发者获得加密后的字符串可与signature对比，标识该请求来源于微信
        if(resultCode === signature){
            ctx.body = echostr;
        }else{
            ctx.body = 'mismatch';
        }
    })




module.exports = CrmRouter;