const fs = require('fs')
const ncp = require('ncp').ncp;
const uuidv1 = require('uuid/v1');
const uuidv4 = require('uuid/v4');
const moment = require('moment')

// 删除文件夹
let unlinkFolderAsync=(path)=>{
    let files = [];
    if(fs.existsSync(path)) {
        files = fs.readdirSync(path);
        files.forEach(function(file, index) {
            let curPath = path + "/" + file;
            if(fs.statSync(curPath).isDirectory()) { // recurse
                unlinkFolderAsync(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
};

// 文件流下载
let streamAsync=(stream)=> {
    return new Promise((resolve, reject) => {
        stream.on('end', () => {
            resolve('end');
        });
        stream.on('error', (error) => {
            reject(error);
        });
    });
};

// 复制文件夹
let copyFolderToFolder=(source, destination)=>{
    return new Promise((resolve, reject) => {
        ncp(source, destination, function (err) {
            if (err) {
                console.error(err)
                reject(err);
            }else {
                resolve('ok');
            }
        });
    });
}

let getUUID=()=>{
    let uuid = uuidv1();
    uuid = uuid.replace(/\-/g,'');
    return uuid
}

let getSID=()=>{
    let uuid = uuidv4();
    uuid = uuid.replace(/\-/g,'');
    return uuid
}

let getISOTime=()=>{
    let t = moment().toISOString()
    return t;
}

let getTimeStamp=(time)=>{
    let t = moment(time).format('YYYY-MM-DD HH:mm:ss')
    return t;
}

let isNullOrUndefined = (val)=> {
    return typeof val === 'undefined' || val == null;
}

let isStringEmpty = (string)=> {
    return isNullOrUndefined(string) || '' === string;
}

let isArrayEmpty = (array)=>{
    return isNullOrUndefined(array) || !Array.isArray(array) || array.length === 0;
}


module.exports = {
    unlinkFolderAsync:unlinkFolderAsync,
    streamAsync:streamAsync,
    copyFolderToFolder:copyFolderToFolder,
    getUUID:getUUID,
    getISOTime:getISOTime,
    isNullOrUndefined:isNullOrUndefined,
    isStringEmpty:isStringEmpty,
    isArrayEmpty:isArrayEmpty,
    getTimeStamp:getTimeStamp,
    getSID:getSID
}