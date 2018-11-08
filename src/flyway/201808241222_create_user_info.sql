CREATE TABLE `user_info` (
`id` varchar(36) CHARACTER SET utf8mb4 NOT NULL COMMENT 'id',
`del` int(1) default 0 COMMENT '删除标志位',
`ybId` varchar (100)  COMMENT '银豹id customerUid',
`ybNumber` varchar (100)  COMMENT '银豹会员号',
`name`  VARCHAR (100)  COMMENT '昵称',
`phone` varchar(30)  comment '用户电话',
`totalScore` int default 0 comment '历史总积分',
`score` int default 0 comment '积分',
`accountName` VARCHAR (20)   COMMENT '账户名',
`wxAccountName`VARCHAR (50)   COMMENT '微信账户名',
`password` varchar(20) comment '密码',
`type` varchar(10) not null comment '用户类型',
`status` varchar(20) comment '状态',
`openid` varchar(50)  comment 'openid',
`birthday` timestamp NULL DEFAULT NULL comment '生日',
`sex` int(1)  comment '性别 1:男 2:女 0:未知',
`headPic` text comment '自定义头像',
`ctime`  timestamp  NOT NULL default CURRENT_TIMESTAMP COMMENT '创建时间',
`activeTime`  timestamp NULL DEFAULT NULL COMMENT '注册时间',
PRIMARY KEY (`id`),
UNIQUE KEY(`phone`),
UNIQUE KEY(`accountName`),
UNIQUE KEY(`wxAccountName`),
UNIQUE KEY(`openid`),
UNIQUE KEY(`ybId`),
UNIQUE KEY(`ybNumber`)
)ENGINE = InnoDB DEFAULT CHARSET = utf8 COMMENT = '用户信息表';