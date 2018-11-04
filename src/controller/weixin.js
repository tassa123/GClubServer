const Router = require('koa-router')
const Log4js = require('koa-log4')
const logger = Log4js.getLogger('weixin');
const RuleResult = require('../config/rule-result')
const WeixinRouter = new Router();
const queryString = require('query-string')
const appConfig = require('../../app');//引入配置文件

const https = require("https");
const moment = require('moment')
const Token = 'i54zyhCKa3o49c4X2' //微信token
const AppId = 'wx95fd881c05d8828d'
const AppSecret = 'f377f13881f0c9337650590b8236b8ef'
const backgroundUrl = 'http://mmbiz.qpic.cn/mmbiz_jpg/vPFgKalzufqFfOvRltHsRxN3J4Na5MGrNuMfGAarN0mT5iaChN2tbZOLFYMLh4t2zBDJ1VqZlSnqDIrm5qGeuQw/0'
const logoUrl = 'http://mmbiz.qpic.cn/mmbiz_jpg/vPFgKalzufqFfOvRltHsRxN3J4Na5MGrNuMfGAarN0mT5iaChN2tbZOLFYMLh4t2zBDJ1VqZlSnqDIrm5qGeuQw/0'
const cardId = 'pW7GpxAm7A4lW8vzWwpUIjfwcNXg'

WeixinRouter
    .post('/wechat', async(ctx) => {
        let params = ctx.request.query || {}
        let xmlJson = ctx.request.body.xml
        console.log(xmlJson,ctx)
        let xml =
            `<xml>
                <ToUserName><![CDATA[${xmlJson.FromUserName[0]}]]></ToUserName>
                 <FromUserName><![CDATA[${xmlJson.ToUserName[0]}]]></FromUserName>
                 <CreateTime>${new Date().getTime()}</CreateTime>
                 <MsgType><![CDATA[text]]></MsgType>
                 <Content><![CDATA[欢迎使用老鬼俱乐部公众号]]></Content>
            </xml>`
        ctx.status = 200;
        ctx.type = 'application/xml'
        ctx.body = ''
    })
    .get('/wechat', async(ctx) => {
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
        let resultCode = string2MD5(tempStr)
        //4.开发者获得加密后的字符串可与signature对比，标识该请求来源于微信
        if(resultCode === signature){
            ctx.body = echostr;
        }else{
            ctx.body = 'mismatch';
        }
    })

class Weixin {
    constructor(){
        this.AccessToken = ''
        this.AccessTokenTime = ''
        this.init()
    }

    async init(){
        // await this.getAccessToken()
        // let result = await this.createMemberCard()
        // console.log(result)
    }

    clearAccessToken(){
        this.AccessToken=null
        this.AccessTokenTime = null
    }

    async  getAccessToken(){
        if(this.AccessToken && this.AccessTokenTime && (moment().unix()-this.AccessTokenTime.unix() < 7000)){
            return
        }
        let options = {
            host: "api.weixin.qq.com",
            path: `/cgi-bin/token?grant_type=client_credential&appid=${AppId}&secret=${AppSecret}`,
            port: 443,
            method: "GET",
            headers: {
                "Content-Type": "application/json;charset=utf-8"
            }
        };
        return new Promise((resolve, reject) => {
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
                        if(res.errcode){
                           this.clearAccessToken()
                            console.log(res,errmsg)
                            reject(res.errmsg)
                        }
                        this.AccessTokenTime = moment()
                        this.AccessToken = res.access_token
                        console.log(`access_token:${this.AccessToken}`)
                        resolve(res.access_token);
                    } catch (e) {
                        this.clearAccessToken()
                        reject(e);
                    }
                });
            });
            req.on("error", (e)=> {
                this.clearAccessToken()
                console.log(e);
                reject(e.message);
            });
            req.end();
        });
    }

    getMemberCard(){
        let cmd = {
            card: {
                card_type: "MEMBER_CARD",
                member_card: {
                    background_pic_url: backgroundUrl,
                    base_info: {
                        logo_url: logoUrl,
                        brand_name: "老鬼俱乐部",
                        code_type: "CODE_TYPE_BARCODE",
                        title: "微信会员测试卡",
                        color: "Color010",
                        notice: "使用时向服务员出示此券",
                        service_phone: "021-64332120",
                        description: "卡券说明balblabla",
                        date_info: {
                            type: "DATE_TYPE_PERMANENT"
                        },
                        sku: {
                            "quantity": 50000000
                        },
                        get_limit: 1,
                        use_custom_code: true,
                        can_give_friend: false,
                        custom_url_name: "立即使用",
                        custom_url: "http://weixin.qq.com",
                        custom_url_sub_title: "6个汉字tips",
                        promotion_url_name: "营销入口1",
                        promotion_url: "http://www.qq.com",
                        need_push_on_view: true
                    },
                    // "advanced_info": {
                    //     "use_condition": {
                    //         "accept_category": "鞋类",
                    //         "reject_category": "阿迪达斯",
                    //         "can_use_with_other_discount": true
                    //     },
                    //     "abstract": {
                    //         "abstract": "微信餐厅推出多种新季菜品，期待您的光临",
                    //         "icon_url_list": [
                    //             "http://mmbiz.qpic.cn/mmbiz/p98FjXy8LacgHxp3sJ3vn97bGLz0ib0Sfz1bjiaoOYA027iasqSG0sjpiby4vce3AtaPu6cIhBHkt6IjlkY9YnDsfw/0"
                    //         ]
                    //     },
                    //     "text_image_list": [
                    //         {
                    //             "image_url": "http://mmbiz.qpic.cn/mmbiz/p98FjXy8LacgHxp3sJ3vn97bGLz0ib0Sfz1bjiaoOYA027iasqSG0sjpiby4vce3AtaPu6cIhBHkt6IjlkY9YnDsfw/0",
                    //             "text": "此菜品精选食材，以独特的烹饪方法，最大程度地刺激食 客的味蕾"
                    //         },
                    //         {
                    //             "image_url": "http://mmbiz.qpic.cn/mmbiz/p98FjXy8LacgHxp3sJ3vn97bGLz0ib0Sfz1bjiaoOYA027iasqSG0sj piby4vce3AtaPu6cIhBHkt6IjlkY9YnDsfw/0",
                    //             "text": "此菜品迎合大众口味，老少皆宜，营养均衡"
                    //         }
                    //     ],
                    //     "time_limit": [
                    //         {
                    //             "type": "MONDAY",
                    //             "begin_hour":0,
                    //             "end_hour":10,
                    //             "begin_minute":10,
                    //             "end_minute":59
                    //         },
                    //         {
                    //             "type": "HOLIDAY"
                    //         }
                    //     ],
                    //     "business_service": [
                    //         "BIZ_SERVICE_FREE_WIFI",
                    //         "BIZ_SERVICE_WITH_PET",
                    //         "BIZ_SERVICE_FREE_PARK",
                    //         "BIZ_SERVICE_DELIVER"
                    //     ]
                    // },
                    supply_bonus: true, // 显示积分
                    supply_balance: false, // 显示余额
                    prerogative: "这是测试用的老鬼会员卡", // 会员卡说明
                    auto_activate: true, // 是否自动激活
                    // custom_field1: {
                    //     name_type: "FIELD_NAME_TYPE_LEVEL",
                    //     url: "http://www.qq.com"
                    // },
                    // activate_url: "http://www.qq.com", // 激活会员卡的URL
                    // custom_cell1: {
                    //     name: "老鬼小菜",
                    //     tips: "一句提示语",
                    //     url: "http://www.qq.com"
                    // },
                    // "bonus_rule": {
                    //     "cost_money_unit": 100,
                    //     "increase_bonus": 1,
                    //     "max_increase_bonus": 200,
                    //     "init_increase_bonus": 10,
                    //     "cost_bonus_unit": 5,
                    //     "reduce_money": 100,
                    //     "least_money_to_use_bonus": 1000,
                    //     "max_reduce_bonus": 50
                    // },
                    // "discount": 10 //折扣
                }
            }
        }
        return cmd
    }

    async createMemberCard(){
        let cmd = {
            card: {
                card_type: "MEMBER_CARD",
                member_card: {
                    background_pic_url: backgroundUrl,
                    base_info: {
                        logo_url: logoUrl,
                        brand_name: "老鬼俱乐部",
                        code_type: "CODE_TYPE_BARCODE",
                        title: "微信会员测试卡",
                        color: "Color010",
                        notice: "使用时向服务员出示此券",
                        service_phone: "021-64332120",
                        description: "卡券说明balblabla",
                        date_info: {
                            type: "DATE_TYPE_PERMANENT"
                        },
                        sku: {
                            "quantity": 50000000
                        },
                        get_limit: 1,
                        use_custom_code: true,
                        can_give_friend: false,
                        custom_url_name: "立即使用",
                        custom_url: "http://weixin.qq.com",
                        custom_url_sub_title: "6个汉字tips",
                        promotion_url_name: "营销入口1",
                        promotion_url: "http://www.qq.com",
                        need_push_on_view: true
                    },
                    // "advanced_info": {
                    //     "use_condition": {
                    //         "accept_category": "鞋类",
                    //         "reject_category": "阿迪达斯",
                    //         "can_use_with_other_discount": true
                    //     },
                    //     "abstract": {
                    //         "abstract": "微信餐厅推出多种新季菜品，期待您的光临",
                    //         "icon_url_list": [
                    //             "http://mmbiz.qpic.cn/mmbiz/p98FjXy8LacgHxp3sJ3vn97bGLz0ib0Sfz1bjiaoOYA027iasqSG0sjpiby4vce3AtaPu6cIhBHkt6IjlkY9YnDsfw/0"
                    //         ]
                    //     },
                    //     "text_image_list": [
                    //         {
                    //             "image_url": "http://mmbiz.qpic.cn/mmbiz/p98FjXy8LacgHxp3sJ3vn97bGLz0ib0Sfz1bjiaoOYA027iasqSG0sjpiby4vce3AtaPu6cIhBHkt6IjlkY9YnDsfw/0",
                    //             "text": "此菜品精选食材，以独特的烹饪方法，最大程度地刺激食 客的味蕾"
                    //         },
                    //         {
                    //             "image_url": "http://mmbiz.qpic.cn/mmbiz/p98FjXy8LacgHxp3sJ3vn97bGLz0ib0Sfz1bjiaoOYA027iasqSG0sj piby4vce3AtaPu6cIhBHkt6IjlkY9YnDsfw/0",
                    //             "text": "此菜品迎合大众口味，老少皆宜，营养均衡"
                    //         }
                    //     ],
                    //     "time_limit": [
                    //         {
                    //             "type": "MONDAY",
                    //             "begin_hour":0,
                    //             "end_hour":10,
                    //             "begin_minute":10,
                    //             "end_minute":59
                    //         },
                    //         {
                    //             "type": "HOLIDAY"
                    //         }
                    //     ],
                    //     "business_service": [
                    //         "BIZ_SERVICE_FREE_WIFI",
                    //         "BIZ_SERVICE_WITH_PET",
                    //         "BIZ_SERVICE_FREE_PARK",
                    //         "BIZ_SERVICE_DELIVER"
                    //     ]
                    // },
                    supply_bonus: true, // 显示积分
                    supply_balance: false, // 显示余额
                    prerogative: "这是测试用的老鬼会员卡", // 会员卡说明
                    auto_activate: true, // 是否自动激活
                    // custom_field1: {
                    //     name_type: "FIELD_NAME_TYPE_LEVEL",
                    //     url: "http://www.qq.com"
                    // },
                    // activate_url: "http://www.qq.com", // 激活会员卡的URL
                    // custom_cell1: {
                    //     name: "老鬼小菜",
                    //     tips: "一句提示语",
                    //     url: "http://www.qq.com"
                    // },
                    // "bonus_rule": {
                    //     "cost_money_unit": 100,
                    //     "increase_bonus": 1,
                    //     "max_increase_bonus": 200,
                    //     "init_increase_bonus": 10,
                    //     "cost_bonus_unit": 5,
                    //     "reduce_money": 100,
                    //     "least_money_to_use_bonus": 1000,
                    //     "max_reduce_bonus": 50
                    // },
                    // "discount": 10 //折扣
                }
            }
        }
        console.log(cmd)
        await this.getAccessToken()
        let str = JSON.stringify(cmd)
        console.log(str)
        let options = {
            host: "api.weixin.qq.com",
            path: `/card/create?access_token=${this.AccessToken}`,
            port: 443,
            method: "POST",
            headers: {
                "Content-Type": "application/json;charset=utf-8",
                "Content-Length": str.length
            }
        };
        return new Promise((resolve, reject) => {
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
                        if(res.errcode){
                            console.log(res)
                            reject(res.errmsg)
                        }
                        resolve(res);
                    } catch (e) {
                        reject(e);
                    }
                });
            });
            req.on("error", (e)=> {
                console.log(e);
                reject(e.message);
            });
            if (str) {
                req.write(str);
            }
            req.end();
        });
    }
}



module.exports = new Weixin();