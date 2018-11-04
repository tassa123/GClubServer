CREATE TABLE `activity_info` (
`id` varchar(36) CHARACTER SET utf8mb4 NOT NULL COMMENT 'id',
`order` int comment '排序',
`online` int default 0 COMMENT '上架状态',
`goodsId` varchar(36) CHARACTER SET utf8mb4 NOT NULL COMMENT '对应商品id',
`pic` JSON comment '商品配图',
`ctime`  timestamp  NOT NULL default CURRENT_TIMESTAMP COMMENT '创建时间',
PRIMARY KEY (`id`)
)ENGINE = InnoDB DEFAULT CHARSET = utf8 COMMENT = '活动信息表';