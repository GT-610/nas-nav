package main

import (
	"crypto/rand"
	"encoding/hex"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"runtime"

	"golang.org/x/crypto/bcrypt"

	"github.com/gin-contrib/cors"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"nas-nav-go/models"
)

var db *gorm.DB

func main() {
	// 初始化数据库
	initDB()

	// 设置路由
	router := setupRouter()

	// 启动服务器
	log.Println("服务启动在 http://0.0.0.0:5000")
	err := router.Run("0.0.0.0:5000")
	if err != nil {
		log.Fatalf("启动服务器失败: %v", err)
	}
}

func initDB() {
	// 获取当前目录
	_, filename, _, _ := runtime.Caller(0)
	baseDir := filepath.Dir(filename)
	dbPath := filepath.Join(baseDir, "db", "nav.db")

	// 确保db目录存在
	dbDir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dbDir, 0755); err != nil {
		log.Fatalf("创建数据库目录失败: %v", err)
	}

	// 连接数据库
	database, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		log.Fatalf("连接数据库失败: %v", err)
	}

	db = database

	// 自动迁移表结构
	db.AutoMigrate(&models.Category{}, &models.Service{}, &models.Auth{})

	// 初始化默认数据
	initDefaultData()
}

func initDefaultData() {
	// 初始化默认分类
	var defaultCategory models.Category
	db.Where("name = ?", "默认").First(&defaultCategory)
	if defaultCategory.ID == 0 {
		defaultCategory = models.Category{Name: "默认"}
		db.Create(&defaultCategory)
	}

	// 初始化默认密码
	var auth models.Auth
	db.First(&auth)
	if auth.ID == 0 {
		passwordHash, err := bcrypt.GenerateFromPassword([]byte("admin"), bcrypt.DefaultCost)
		if err != nil {
			log.Fatalf("生成密码哈希失败: %v", err)
		}
		auth = models.Auth{PasswordHash: string(passwordHash)}
		db.Create(&auth)
		log.Println("[安全警告] 已创建默认密码admin，请立即修改！")
	}
}

func setupRouter() *gin.Engine {
	// 创建路由引擎
	router := gin.Default()

	// 配置CORS
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// 生成随机密钥
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		log.Fatalf("生成会话密钥失败: %v", err)
	}
	secretKey := hex.EncodeToString(key)

	// 配置会话
	store := cookie.NewStore([]byte(secretKey))
	store.Options(sessions.Options{
		HttpOnly: true,
		Path:     "/",
		MaxAge:   15 * 60, // 15分钟
	})
	router.Use(sessions.Sessions("nas-nav-session", store))

	// 静态文件服务
	router.Static("/static", "./static")

	// 主页面路由 - 使用新版前端
	router.GET("/", func(c *gin.Context) {
		c.File("./static/next/html/index.html")
	})

	// 后台管理入口 - 使用新版前端
	router.GET("/admin", func(c *gin.Context) {
		c.File("./static/next/html/admin.html")
	})

	// 公开API
	publicAPI := router.Group("/api/public")
	{
		publicAPI.GET("/services", getPublicServices)
		publicAPI.GET("/categories", getCategories)
	}

	// 管理API (需要认证)
	adminAPI := router.Group("/api")
	adminAPI.Use(authMiddleware())
	{
		// 服务管理
		adminAPI.GET("/services", getServices)
		adminAPI.POST("/services", addService)
		adminAPI.PUT("/services/:id", updateService)
		adminAPI.DELETE("/services/:id", deleteService)
		adminAPI.POST("/services/reorder", reorderServices)

		// 分类管理
		adminAPI.POST("/categories", addCategory)
		adminAPI.PUT("/categories/:id", updateCategory)
		adminAPI.DELETE("/categories/:id", deleteCategory)
	}

	// 认证相关
	router.POST("/admin/login", adminLogin)
	router.POST("/admin/logout", adminLogout)
	router.POST("/admin/change-password", authMiddleware(), changePassword)

	// 错误处理
	router.NoRoute(func(c *gin.Context) {
		c.JSON(http.StatusNotFound, gin.H{"error": "资源未找到"})
	})

	return router
}

// 认证中间件
func authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		session := sessions.Default(c)
		authenticated := session.Get("authenticated")

		if authenticated != true {
			c.JSON(http.StatusForbidden, gin.H{"error": "未授权访问"})
			c.Abort()
			return
		}

		c.Next()
	}
}

// 获取公开服务数据
func getPublicServices(c *gin.Context) {
	var services []models.Service
	if err := db.Preload("Category").Order("sort_order").Find(&services).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "数据库查询失败"})
		return
	}

	// 转换为前端需要的格式
	result := make([]map[string]interface{}, 0)
	for _, s := range services {
		categoryName := "未分类"
		if s.Category.ID > 0 {
			categoryName = s.Category.Name
		}

		item := map[string]interface{}{
			"name":        s.Name,
			"category":    categoryName,
			"ip_url":      s.IPURL,
			"domain_url":  s.DomainURL,
			"description": s.Description,
			"icon_url":    s.Icon,
		}
		result = append(result, item)
	}

	c.JSON(http.StatusOK, result)
}

// 获取所有分类
func getCategories(c *gin.Context) {
	var categories []models.Category
	if err := db.Order("id").Find(&categories).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "分类查询失败"})
		return
	}

	result := make([]map[string]interface{}, 0)
	for _, category := range categories {
		result = append(result, map[string]interface{}{
			"id":   category.ID,
			"name": category.Name,
		})
	}

	c.JSON(http.StatusOK, result)
}

// 获取所有服务（管理用）
func getServices(c *gin.Context) {
	var services []models.Service
	if err := db.Preload("Category").Order("sort_order").Find(&services).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "数据库查询失败"})
		return
	}

	result := make([]map[string]interface{}, 0)
	for _, s := range services {
		item := map[string]interface{}{
			"id":          s.ID,
			"name":        s.Name,
			"ip_url":      s.IPURL,
			"domain_url":  s.DomainURL,
			"category_id": s.CategoryID,
			"category":    s.Category.Name,
			"sort_order":  s.SortOrder,
			"description": s.Description,
			"icon":        s.Icon,
		}
		result = append(result, item)
	}

	c.JSON(http.StatusOK, result)
}

// 添加新服务
func addService(c *gin.Context) {
	var serviceInput struct {
		Name        string `json:"name" binding:"required"`
		IPURL       string `json:"ip_url" binding:"required"`
		DomainURL   string `json:"domain_url" binding:"required"`
		CategoryID  uint   `json:"category_id" binding:"required"`
		Description string `json:"description"`
		Icon        string `json:"icon"`
	}

	if err := c.ShouldBindJSON(&serviceInput); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 检查服务名称是否已存在
	var existingService models.Service
	if err := db.Where("name = ?", serviceInput.Name).First(&existingService).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "服务名称已存在"})
		return
	}

	// 获取最大排序值
	var maxOrder int
	db.Model(&models.Service{}).Select("MAX(sort_order)").Scan(&maxOrder)

	// 创建新服务
	service := models.Service{
		Name:        serviceInput.Name,
		IPURL:       serviceInput.IPURL,
		DomainURL:   serviceInput.DomainURL,
		CategoryID:  serviceInput.CategoryID,
		Description: serviceInput.Description,
		Icon:        serviceInput.Icon,
		SortOrder:   maxOrder + 1,
	}

	if err := db.Create(&service).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "添加服务失败"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"id": service.ID})
}

// 更新服务信息
func updateService(c *gin.Context) {
	serviceID := c.Param("id")

	var service models.Service
	if err := db.First(&service, serviceID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "服务不存在"})
		return
	}

	var serviceInput struct {
		Name        string `json:"name"`
		IPURL       string `json:"ip_url"`
		DomainURL   string `json:"domain_url"`
		CategoryID  uint   `json:"category_id"`
		Description string `json:"description"`
		Icon        string `json:"icon"`
	}

	if err := c.ShouldBindJSON(&serviceInput); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 如果更新了名称，检查是否已存在
	if serviceInput.Name != "" && serviceInput.Name != service.Name {
		var existingService models.Service
		if err := db.Where("name = ? AND id != ?", serviceInput.Name, service.ID).First(&existingService).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "服务名称已存在"})
			return
		}
		service.Name = serviceInput.Name
	}

	// 更新其他字段
	if serviceInput.IPURL != "" {
		service.IPURL = serviceInput.IPURL
	}
	if serviceInput.DomainURL != "" {
		service.DomainURL = serviceInput.DomainURL
	}
	if serviceInput.CategoryID > 0 {
		service.CategoryID = serviceInput.CategoryID
	}
	if serviceInput.Description != "" {
		service.Description = serviceInput.Description
	}
	if serviceInput.Icon != "" {
		service.Icon = serviceInput.Icon
	}

	if err := db.Save(&service).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新服务失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// 删除服务
func deleteService(c *gin.Context) {
	serviceID := c.Param("id")

	var service models.Service
	if err := db.First(&service, serviceID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "服务不存在"})
		return
	}

	deletedOrder := service.SortOrder

	if err := db.Delete(&service).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除失败：该服务可能被其他数据关联"})
		return
	}

	// 更新排序
	db.Model(&models.Service{}).Where("sort_order > ?", deletedOrder).Update("sort_order", gorm.Expr("sort_order - 1"))

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// 重新排序服务
func reorderServices(c *gin.Context) {
	var newOrder []uint
	if err := c.ShouldBindJSON(&newOrder); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 使用事务确保数据一致性
	tx := db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	if err := tx.Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "数据库事务失败"})
		return
	}

	for index, serviceID := range newOrder {
		if err := tx.Model(&models.Service{}).Where("id = ?", serviceID).Update("sort_order", index+1).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "排序更新失败"})
			return
		}
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "排序更新失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// 添加新分类
func addCategory(c *gin.Context) {
	var categoryInput struct {
		Name string `json:"name" binding:"required"`
	}

	if err := c.ShouldBindJSON(&categoryInput); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 检查分类名称是否已存在
	var existingCategory models.Category
	if err := db.Where("name = ?", categoryInput.Name).First(&existingCategory).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "分类名称已存在"})
		return
	}

	// 创建新分类
	category := models.Category{Name: categoryInput.Name}

	if err := db.Create(&category).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "添加分类失败"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"id": category.ID})
}

// 更新分类信息
func updateCategory(c *gin.Context) {
	categoryID := c.Param("id")

	var category models.Category
	if err := db.First(&category, categoryID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "分类不存在"})
		return
	}

	var categoryInput struct {
		Name string `json:"name" binding:"required"`
	}

	if err := c.ShouldBindJSON(&categoryInput); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 检查分类名称是否已存在（排除当前分类）
	var existingCategory models.Category
	if err := db.Where("name = ? AND id != ?", categoryInput.Name, category.ID).First(&existingCategory).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "分类名称已存在"})
		return
	}

	category.Name = categoryInput.Name

	if err := db.Save(&category).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新分类失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// 删除分类
func deleteCategory(c *gin.Context) {
	categoryID := c.Param("id")

	var category models.Category
	if err := db.First(&category, categoryID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "分类不存在"})
		return
	}

	// 检查是否有服务关联
	var serviceCount int64
	db.Model(&models.Service{}).Where("category_id = ?", categoryID).Count(&serviceCount)
	if serviceCount > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "请先删除该分类下的所有服务"})
		return
	}

	if err := db.Delete(&category).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除分类失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// 管理员登录
func adminLogin(c *gin.Context) {
	var loginInput struct {
		Password string `json:"password" binding:"required"`
	}

	if err := c.ShouldBindJSON(&loginInput); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "需要密码字段"})
		return
	}

	var auth models.Auth
	if err := db.First(&auth).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "无效凭证"})
		return
	}

	// 验证密码
	if err := bcrypt.CompareHashAndPassword([]byte(auth.PasswordHash), []byte(loginInput.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "无效凭证"})
		return
	}

	// 设置会话
	session := sessions.Default(c)
	session.Clear()
	session.Set("authenticated", true)
	session.Save()

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// 管理员登出
func adminLogout(c *gin.Context) {
	session := sessions.Default(c)
	session.Clear()
	session.Save()

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// 修改管理员密码
func changePassword(c *gin.Context) {
	var passwordInput struct {
		OldPassword string `json:"oldPassword" binding:"required"`
		NewPassword string `json:"newPassword" binding:"required"`
	}

	if err := c.ShouldBindJSON(&passwordInput); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "需要原密码和新密码字段"})
		return
	}

	// 验证新密码复杂度
	if len(passwordInput.NewPassword) < 8 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "后端提示：密码长度至少8位"})
		return
	}

	hasUpperCase := false
	hasDigit := false
	for _, char := range passwordInput.NewPassword {
		if char >= 'A' && char <= 'Z' {
			hasUpperCase = true
		}
		if char >= '0' && char <= '9' {
			hasDigit = true
		}
	}

	if !hasUpperCase {
		c.JSON(http.StatusBadRequest, gin.H{"error": "后端提示：必须包含至少一个大写字母"})
		return
	}
	if !hasDigit {
		c.JSON(http.StatusBadRequest, gin.H{"error": "后端提示：必须包含至少一个数字"})
		return
	}

	var auth models.Auth
	if err := db.First(&auth).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取认证信息失败"})
		return
	}

	// 验证原密码
	if err := bcrypt.CompareHashAndPassword([]byte(auth.PasswordHash), []byte(passwordInput.OldPassword)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "原密码错误"})
		return
	}

	// 更新密码
	newPasswordHash, err := bcrypt.GenerateFromPassword([]byte(passwordInput.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "生成密码哈希失败"})
		return
	}

	auth.PasswordHash = string(newPasswordHash)
	if err := db.Save(&auth).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新密码失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}