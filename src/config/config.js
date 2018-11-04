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
    online:'online',
    offline:'offline',
    deleted:'deleted',
    normal:'normal',
    canceled:'canceled',
    invalidSid:'invalidSid',
    unactivated:'unactivated'
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
    verify:'verify',
    sendQuestionnaire:'sendQuestionnaire',
    pushMsg:'pushMsg'
};

const cUserOp={
    login:'login'
}

const cCmdType = {
    fileUpload:'file_upload',
    //admin
    SysLogin: 'sys_login',  //后台管理员登录
    SysUser:'sys_user',
    SysGoods:'sys_goods',
    SysActivity:'sys_activity',

    // user
    UserSignUp: 'user_sign_up',
    UserLogin: 'user_login'
};

const cUserType  = {
    admin : 'admin',
    guest : 'guest',
    user : 'user',
    doctor : 'doctor',
    sys : 'sys',
    clinic:'clinic',
}
const cConferenceType = {
    agent:'agent'
}

const cAnswerType={
    customizedInfo:'customizedInfo',
    interaction:'interaction',
    questionnaire:'questionnaire'
}

module.exports = {
    cStatus:cStatus,
    cOpType:cOpType,
    cCmdType:cCmdType,
    cUserType:cUserType,
    cUserOp:cUserOp,
    cConferenceType:cConferenceType,
    cAnswerType:cAnswerType
};