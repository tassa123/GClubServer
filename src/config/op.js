const {getTimeStamp} = require('../service/util-service')
class Op {
    constructor(name='',msg='',ctime=getTimeStamp()){
        this.name = name;
        this.msg = msg;
        this.ctime = ctime;
    }
    setName(name){
        this.name = name || null;
    }
    getSt(){
        return this.name;
    }

    setMsg(msg){
        this.msg = msg || null;
    }
    getMsg(){
        return this.msg;
    }

    setCtime(ctime){
        this.ctime = ctime || null;
    }
    getCtime(){
        return this.ctime;
    }
}

module.exports = Op;
