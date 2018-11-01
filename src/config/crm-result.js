const {cStatus} = require("./config")
class CRMResult {
    constructor(st = cStatus.ok,data = null,msg = null){
        this.st = st;
        this.data = data;
        this.msg = msg;
    }
    setSt(st){
        this.st = st || null;
    }
    getSt(){
        return this.st;
    }

    setData(data){
        this.data = data || null;
    }
    getData(){
        return this.data;
    }

    setMsg(msg){
        this.msg = msg || null;
    }
    getMsg(){
        return this.msg;
    }

    success(){
        this.st = cStatus.ok
    }

    fail(){
        this.st = cStatus.fail
        this.data = null;
    }

    err(){
        this.st = cStatus.err
        this.data = null
        this.msg = 'error!!'
    }
}
module.exports = CRMResult;