package main

import (
	"log"
	"os"
	"path/filepath"
	"runtime"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"nas-nav-go/models"
)

func main() {
	// 获取当前目录
	_, filename, _, _ := runtime.Caller(0)
	// 向上两级目录找到项目根目录
	baseDir := filepath.Dir(filepath.Dir(filename))
	dbPath := filepath.Join(baseDir, "db", "nav.db")

	// 确保db目录存在
	dbDir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dbDir, 0755); err != nil {
		log.Fatalf("创建数据库目录失败: %v", err)
	}

	// 检查数据库文件是否存在
	if _, err := os.Stat(dbPath); err == nil {
		// 数据库已存在，询问是否覆盖
		log.Println("警告: 数据库已存在!")
		log.Println("如需重新初始化，请先删除nav.db文件")
		os.Exit(0)
	}

	// 连接数据库
	database, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{}
	if err != nil {
		log.Fatalf("连接数据库失败: %v", err)
	}

	// 自动迁移表结构
	database.AutoMigrate(&models.Category{}, &models.Service{}, &models.Auth{})

	// 初始化默认数据
	initDefaultData(database)

	log.Println("数据库初始化成功!")
}

func initDefaultData(db *gorm.DB) {
	// 初始化默认分类
	defaultCategory := models.Category{Name: "默认"}
	db.Create(&defaultCategory)

	// 初始化默认密码
	passwordHash, err := bcrypt.GenerateFromPassword([]byte("admin"), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("生成密码哈希失败: %v", err)
	}
	auth := models.Auth{PasswordHash: string(passwordHash)}
	db.Create(&auth)
	log.Println("[安全警告] 已创建默认密码admin，请立即修改!")
}