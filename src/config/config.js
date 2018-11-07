// 状态字典表
const cStatus = {
    ok:'ok',
    fail:'fail',
    err:'err',
    invalidParams:'invalidParams',
    except:'except',
    overflow:'overflow',
    acked:'acked',
    finished:'finished',
    denied:'denied',
    existing:'existing',
    notExists:'notExists',
    unknownCmd:'unknownCmd',
    pwdErr:'pwdErr',
    pending:'pending',
    deny:'deny',
    noMore:'noMore',
    normal:'normal',
    canceled:'canceled',
    invalidSid:'invalidSid',
    unactivated:'unactivated',
    shortOfGoods:'shortOfGoods',
    shortOfFund:'shortOfFund',
    notAllowed:'notAllowed'
}

const cOpType = {
    //通用的操作类型
    ack:'ack',  //确认
    cancel:'cancel',
    delete:'delete',
    block:'block',
    online:'online',
    offline:'offline',
    create:'create', //新建
    get:'get',  //获取
    set:'set',
    check:'check',
    verify:'verify'
};

const cUserOp={
    login:'login'
}

const cCmdType = {
    // crm

    fileUpload:'file_upload',
    //admin
    SysLogin: 'sys_login',  //后台管理员登录
    SysUser:'sys_user',
    SysGoods:'sys_goods',
    SysActivity:'sys_activity',
    SysOrder:'sys_order',

    // user
    UserSignUp: 'user_sign_up',
    UserLogin: 'user_login',
    UserOrder:'user_order'
};

const cUserType  = {
    admin : 'admin',
    user : 'user',
    sys : 'sys',
}

const cOrderType = {
    exchange:'exchange',
    ticket:'ticket',
    bill:'bill'
}

const cMsgType = {
    vcode:'vcode', // 验证码
    invite:'invite',// 邀请注册
    levelUp:"levelUp",// 升级
    scoreChange:'scoreChange',// 积分变动
}


module.exports = {
    cStatus:cStatus,
    cOpType:cOpType,
    cCmdType:cCmdType,
    cUserType:cUserType,
    cUserOp:cUserOp,
    cOrderType:cOrderType,
    cMsgType:cMsgType
};