package models

import "gorm.io/gorm"

// Category 分类数据模型

type Category struct {
	gorm.Model
	Name string `gorm:"size:50;unique;not null"`
	Services []Service // 反向关联
}