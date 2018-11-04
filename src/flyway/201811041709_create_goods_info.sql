CREATE TABLE `goods_info` (
`id` varchar(36) CHARACTER SET utf8mb4 NOT NULL COMMENT 'id',
`del` tinyint default 0 COMMENT '删除标志位',
`amount` int default 0 comment '库存量',
`online` int default 0 comment '上架状态',
`name` varchar(100) comment '商品名称',
`score` int default 0 comment '所需积分',
`des` text comment '描述',
`pic` JSON comment '商品配图',
`ctime`  timestamp  NOT NULL default CURRENT_TIMESTAMP COMMENT '创建时间',
PRIMARY KEY (`id`)
)ENGINE = InnoDB DEFAULT CHARSET = utf8 COMMENT = '商品信息表';