CREATE TABLE `order_info` (
`id` varchar(36) CHARACTER SET utf8mb4 NOT NULL COMMENT 'id',
`del` tinyint default 0 COMMENT '删除标志位',
`outId` varchar(100)  comment '外部ID',
`userId` varchar(36) CHARACTER SET utf8mb4 COMMENT '用户id',
`goodsId` varchar(36) CHARACTER SET utf8mb4 COMMENT '商品id',
`goods` JSON comment '商品信息',
`score` int default 0 comment '积分变动',
`rate` float(5,2) default 1.00 comment '积分倍率',
`type` varchar(10) not null comment '订单类型',
`status` varchar(20) comment '状态',
`ctime`  timestamp  NOT NULL default CURRENT_TIMESTAMP COMMENT '创建时间',
`logs` JSON comment '操作日志',
PRIMARY KEY (`id`),
UNIQUE KEY(`outId`)
)ENGINE = InnoDB DEFAULT CHARSET = utf8 COMMENT = '订单信息表';