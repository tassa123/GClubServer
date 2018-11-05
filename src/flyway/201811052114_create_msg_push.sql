CREATE TABLE `msg_push` (
`id` varchar(36) CHARACTER SET utf8mb4 NOT NULL COMMENT 'id',
`userId` varchar(36) CHARACTER SET utf8mb4 NOT NULL COMMENT '用户id',
`reason` varchar(20) comment '原因',
`type` varchar(36) NOT NULL comment '推送方式',
`msg` text comment '消息体',
`ctime`  timestamp  NOT NULL default CURRENT_TIMESTAMP COMMENT '创建时间',
PRIMARY KEY (`id`)
)ENGINE = InnoDB DEFAULT CHARSET = utf8 COMMENT = '积分日志表';