CREATE TABLE `score_log` (
`id` varchar(36) CHARACTER SET utf8mb4 NOT NULL COMMENT 'id',
`userId` varchar(36) CHARACTER SET utf8mb4 NOT NULL COMMENT '用户id',
`orderId` varchar(36) CHARACTER SET utf8mb4  COMMENT '订单id',
`msg` text comment '备注',
`score` int default 0 COMMENT '积分变化',
`ctime`  timestamp  NOT NULL default CURRENT_TIMESTAMP COMMENT '创建时间',
PRIMARY KEY (`id`)
)ENGINE = InnoDB DEFAULT CHARSET = utf8 COMMENT = '积分日志表';