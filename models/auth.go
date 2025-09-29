package models

import "gorm.io/gorm"

// Auth 认证数据模型

type Auth struct {
	gorm.Model
	PasswordHash string `gorm:"size:128;not null"`
}