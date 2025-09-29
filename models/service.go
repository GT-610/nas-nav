package models

import "gorm.io/gorm"

// Service 服务导航数据模型

type Service struct {
	gorm.Model
	Name        string  `gorm:"size:80;unique;not null"`
	CategoryID  uint    `gorm:"not null"`
	Category    Category `gorm:"foreignKey:CategoryID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`
	IPURL       string  `gorm:"size:200"`  // IP地址字段
	DomainURL   string  `gorm:"size:200;not null"`  // 域名字段
	Description string  `gorm:"size:200"`
	Icon        string  `gorm:"size:200"`
	SortOrder   int     `gorm:"default:999"`
}