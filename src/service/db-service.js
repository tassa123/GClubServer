const mysql      = require('mysql');
const appConfig = require('../../app');//引入配置文件
const Log4js = require('koa-log4')
const logger = Log4js.getLogger('mysql');
const fs = require('fs')
const path = require('path')
const _ = require('lodash')
const utilService = require('./util-service')
let pool = mysql.createPool({
    host     : appConfig.dbHost,
    user     : appConfig.dbUser,
    password : appConfig.dbPassword,
    database : appConfig.dbDatabase
});

pool.on('connection', function (connection) {
    logger.info(`mysql connect on  ${appConfig.dbHost}:${appConfig.dbDatabase} as ${connection.threadId}`)
});

async function commonQuery(query,params,debug=false){
    return new Promise((resolve,reject)=>{
        pool.getConnection(function(err, connection) {
            if(err) {
                logger.log(err);
                reject(err);
                return;
            }
            connection.query(query,params, function (error, results, fields) {
                connection.release();
                if (error){
                    let sql = mysql.format(query, params);
                    logger.error(sql)
                    reject(error)
                }else if(debug){
                    let sql = mysql.format(query, params);
                    logger.info(sql)
                }

                resolve(results)
            });
        });
    })
}

async function initDB(){
    let flywayFolder = path.resolve(__dirname,'..','flyway')
    let files =  fs.readdirSync(flywayFolder)
    files = _.sortBy(files,fileName=>{
            let time = fileName.split('_')[0]
            return time
    })

    let flywayTable =
        "CREATE TABLE IF NOT EXISTS `flyway` (" +
        "`key` varchar(200) NOT NULL  COMMENT '主键',"+
        "`query` text NOT NULL," +
        "PRIMARY KEY(`key`)"+
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='flyway表';"
    await commonQuery(flywayTable)
    for(let file of files){
        if(file.indexOf('banned.sql')>-1){
            continue;
        }
        let query = "select * from flyway where `key` = ?;"
        let filePath = path.resolve(flywayFolder,file)
        let isExistResult = await commonQuery(query,file)
        if(0 === isExistResult.length){
            let insertQuery = "insert into `flyway` (`key`,`query`) values (?,?)"
            let content = fs.readFileSync(filePath).toString();
            let queryResult = await commonQuery(content)
            let insertResult = await commonQuery(insertQuery,[file,content])
        }
    }
    // 部分自定义
}

module.exports = {
    initDB:initDB,
    commonQuery:commonQuery
}