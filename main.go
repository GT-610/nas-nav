package main

import (
	"flag"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/session/v2"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"nas-nav-go/models"
)

var db *gorm.DB
var debugMode bool
var sessionManager *session.Session

func main() {
	// 解析命令行参数
	initDBFlag := flag.Bool("initdb", false, "初始化数据库")
	helpFlag := flag.Bool("help", false, "显示帮助信息")
	debugModeFlag := flag.Bool("debug", false, "启用调试模式")
	flag.Parse()

	// 如果请求帮助，显示帮助信息并退出
	if *helpFlag {
		showHelp()
		return
	}

	// 设置调试模式
	debugMode = *debugModeFlag

	// 如果请求初始化数据库
	if *initDBFlag {
		initDB(true) // 强制初始化
		return
	}

	// 正常启动流程 - 检查并初始化数据库（如果不存在）
	initDB(false)

	// 设置路由
	app := setupRouter()

	// 启动服务器
	log.Println("服务启动在 http://0.0.0.0:5000")
	if debugMode {
		log.Println("[调试模式] 已启用")
	}
	err := app.Listen(":5000")
	if err != nil {
		log.Fatalf("启动服务器失败: %v", err)
	}
}

// 显示帮助信息
func showHelp() {
	log.Println("NAS导航服务使用帮助:")
	log.Println("  ./nas-nav-go               - 正常启动服务（自动检测并初始化数据库）")
	log.Println("  ./nas-nav-go -initdb       - 初始化数据库")
	log.Println("  ./nas-nav-go -debug        - 启用调试模式启动服务")
	log.Println("  ./nas-nav-go -help         - 显示帮助信息")
}

func initDB(force bool) {
	// 获取当前目录
	_, filename, _, _ := runtime.Caller(0)
	baseDir := filepath.Dir(filename)
	dbPath := filepath.Join(baseDir, "db", "nav.db")

	// 确保db目录存在
	dbDir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dbDir, 0755); err != nil {
		log.Fatalf("创建数据库目录失败: %v", err)
	}

	// 检查数据库文件是否存在
	dbExists := true
	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		dbExists = false
	} else if force {
		// 如果强制初始化，先删除现有数据库
		if err := os.Remove(dbPath); err != nil {
			log.Fatalf("删除现有数据库失败: %v", err)
		}
		dbExists = false
	}

	// 连接数据库
	database, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		log.Fatalf("连接数据库失败: %v", err)
	}

	db = database

	// 如果是新数据库或者强制初始化，进行表结构迁移和默认数据初始化
	if !dbExists {
		log.Println("检测到数据库不存在，正在初始化...")
		// 自动迁移表结构
		db.AutoMigrate(&models.Category{}, &models.Service{}, &models.Auth{})

		// 初始化默认数据
		initDefaultData()
	} else if debugMode {
		log.Println("使用现有数据库")
	}
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

func setupRouter() *fiber.App {
	// 创建路由引擎
	app := fiber.New(fiber.Config{
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
			}
			return c.Status(code).JSON(fiber.Map{"error": err.Error()})
		},
	})

	// 配置CORS
	app.Use(cors.New(cors.Config{
		AllowOrigins:     "*",
		AllowMethods:     "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders:     "Origin,Content-Type,Authorization",
		ExposeHeaders:    "Content-Length",
		AllowCredentials: false,
	}))

	// 配置会话
	sessionManager = session.New(session.Config{
		Expiration: 15 * time.Minute,
	})

	// 静态文件服务
	app.Static("/static", "./static")

	// 公开API
	publicAPI := app.Group("/api/public")
	{
		publicAPI.Get("/services", getPublicServices)
		publicAPI.Get("/categories", getCategories)
	}

	// 管理API (需要认证)
	adminAPI := app.Group("/api")
	adminAPI.Use(authMiddleware)
	{
		// 服务管理
		adminAPI.Get("/services", getServices)
		adminAPI.Post("/services", addService)
		adminAPI.Put("/services/:id", updateService)
		adminAPI.Delete("/services/:id", deleteService)
		adminAPI.Post("/services/reorder", reorderServices)

		// 分类管理
		adminAPI.Get("/categories", getCategories)
		adminAPI.Post("/categories", addCategory)
		adminAPI.Put("/categories/:id", updateCategory)
		adminAPI.Delete("/categories/:id", deleteCategory)
	}

	// 认证相关
	app.Post("/api/auth/login", adminLogin)
	app.Post("/api/auth/logout", adminLogout)
	app.Post("/api/auth/change-password", authMiddleware, changePassword)

	// 主页面路由 - 使用新版前端
	app.Get("/", func(c *fiber.Ctx) error {
		return c.SendFile("./static/index.html")
	})

	// 后台管理入口 - 使用新版前端
	app.Get("/admin", func(c *fiber.Ctx) error {
		return c.SendFile("./static/index.html")
	})

	// 所有其他GET请求都返回主页面，让React Router处理路由
	app.Get("/*", func(c *fiber.Ctx) error {
		return c.SendFile("./static/index.html")
	})

	// 错误处理
	app.Use(func(c *fiber.Ctx) error {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "资源未找到"})
	})

	return app
}

// 认证中间件
func authMiddleware(c *fiber.Ctx) error {
	sess := sessionManager.Get(c)
	authenticated := sess.Get("authenticated")

	if authenticated != true {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "未授权访问"})
	}

	return c.Next()
}

// 获取公开服务数据
func getPublicServices(c *fiber.Ctx) error {
	var services []models.Service
	if err := db.Preload("Category").Order("sort_order").Find(&services).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "数据库查询失败"})
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

	return c.JSON(result)
}

// 获取所有分类
func getCategories(c *fiber.Ctx) error {
	var categories []models.Category
	if err := db.Order("id").Find(&categories).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "分类查询失败"})
	}

	result := make([]map[string]interface{}, 0)
	for _, category := range categories {
		result = append(result, map[string]interface{}{
			"id":   category.ID,
			"name": category.Name,
		})
	}

	return c.JSON(result)
}

// 获取所有服务（管理用）
func getServices(c *fiber.Ctx) error {
	var services []models.Service
	if err := db.Preload("Category").Order("sort_order").Find(&services).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "数据库查询失败"})
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

	return c.JSON(result)
}

// 添加新服务
func addService(c *fiber.Ctx) error {
	var serviceInput struct {
		Name        string `json:"name"`
		IPURL       string `json:"ip_url"`
		DomainURL   string `json:"domain_url"`
		CategoryID  uint   `json:"category_id"`
		Description string `json:"description"`
		Icon        string `json:"icon"`
	}

	if err := c.BodyParser(&serviceInput); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "请求参数错误：" + err.Error()})
	}

	// 检查必填字段
	if serviceInput.Name == "" || serviceInput.IPURL == "" || serviceInput.DomainURL == "" || serviceInput.CategoryID == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "缺少必填字段"})
	}

	// 检查分类是否存在
	var category models.Category
	if err := db.First(&category, serviceInput.CategoryID).Error; err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "指定的分类不存在"})
	}

	// 检查服务名称是否已存在
	var existingService models.Service
	if err := db.Where("name = ?", serviceInput.Name).First(&existingService).Error; err == nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "服务名称已存在"})
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
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "添加服务失败：" + err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"id": service.ID})
}

// 更新服务信息
func updateService(c *fiber.Ctx) error {
	serviceID := c.Params("id")

	var service models.Service
	if err := db.First(&service, serviceID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "服务不存在"})
	}

	var serviceInput struct {
		Name        string `json:"name"`
		IPURL       string `json:"ip_url"`
		DomainURL   string `json:"domain_url"`
		CategoryID  uint   `json:"category_id"`
		Description string `json:"description"`
		Icon        string `json:"icon"`
	}

	if err := c.BodyParser(&serviceInput); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "请求参数错误：" + err.Error()})
	}

	// 如果更新了名称，检查是否已存在
	if serviceInput.Name != "" && serviceInput.Name != service.Name {
		var existingService models.Service
		if err := db.Where("name = ? AND id != ?", serviceInput.Name, service.ID).First(&existingService).Error; err == nil {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "服务名称已存在"})
		}
		service.Name = serviceInput.Name
	}

	// 如果更新了分类，检查分类是否存在
	if serviceInput.CategoryID > 0 && serviceInput.CategoryID != service.CategoryID {
		var category models.Category
		if err := db.First(&category, serviceInput.CategoryID).Error; err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "指定的分类不存在"})
		}
		service.CategoryID = serviceInput.CategoryID
	}

	// 更新其他字段
	if serviceInput.IPURL != "" {
		service.IPURL = serviceInput.IPURL
	}
	if serviceInput.DomainURL != "" {
		service.DomainURL = serviceInput.DomainURL
	}
	if serviceInput.Description != "" {
		service.Description = serviceInput.Description
	}
	if serviceInput.Icon != "" {
		service.Icon = serviceInput.Icon
	}

	if err := db.Save(&service).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "更新服务失败：" + err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"success": true})
}

// 删除服务
func deleteService(c *fiber.Ctx) error {
	serviceID := c.Params("id")

	var service models.Service
	if err := db.First(&service, serviceID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "服务不存在"})
	}

	deletedOrder := service.SortOrder

	// 使用事务确保数据一致性
	tx := db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	if err := tx.Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "数据库事务失败"})
	}

	// 删除服务
	if err := tx.Delete(&service).Error; err != nil {
		tx.Rollback()
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "删除失败：该服务可能被其他数据关联"})
	}

	// 更新排序
	if err := tx.Model(&models.Service{}).Where("sort_order > ?", deletedOrder).Update("sort_order", gorm.Expr("sort_order - 1")).Error; err != nil {
		tx.Rollback()
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "更新排序失败"})
	}

	// 提交事务
	if err := tx.Commit().Error; err != nil {
		tx.Rollback()
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "提交事务失败"})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"success": true})
}

// 重新排序服务
func reorderServices(c *fiber.Ctx) error {
	var newOrder []uint
	if err := c.BodyParser(&newOrder); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	// 使用事务确保数据一致性
	tx := db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	if err := tx.Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "数据库事务失败"})
	}

	for index, serviceID := range newOrder {
		if err := tx.Model(&models.Service{}).Where("id = ?", serviceID).Update("sort_order", index+1).Error; err != nil {
			tx.Rollback()
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "排序更新失败"})
		}
	}

	if err := tx.Commit().Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "排序更新失败"})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"success": true})
}

// 添加新分类
func addCategory(c *fiber.Ctx) error {
	var categoryInput struct {
		Name string `json:"name"`
	}

	if err := c.BodyParser(&categoryInput); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "请求参数错误：" + err.Error()})
	}

	// 检查必填字段
	if categoryInput.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "缺少必填字段"})
	}

	// 检查分类名称是否已存在
	var existingCategory models.Category
	if err := db.Where("name = ?", categoryInput.Name).First(&existingCategory).Error; err == nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "分类名称已存在"})
	}

	// 创建新分类
	category := models.Category{Name: categoryInput.Name}

	if err := db.Create(&category).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "添加分类失败：" + err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"id": category.ID})
}

// 更新分类信息
func updateCategory(c *fiber.Ctx) error {
	categoryID := c.Params("id")

	var category models.Category
	if err := db.First(&category, categoryID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "分类不存在"})
	}

	var categoryInput struct {
		Name string `json:"name"`
	}

	if err := c.BodyParser(&categoryInput); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "请求参数错误：" + err.Error()})
	}

	// 检查必填字段
	if categoryInput.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "缺少必填字段"})
	}

	// 检查分类名称是否已存在（排除当前分类）
	var existingCategory models.Category
	if err := db.Where("name = ? AND id != ?", categoryInput.Name, category.ID).First(&existingCategory).Error; err == nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "分类名称已存在"})
	}

	category.Name = categoryInput.Name

	if err := db.Save(&category).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "更新分类失败：" + err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"success": true})
}

// 删除分类
func deleteCategory(c *fiber.Ctx) error {
	categoryID := c.Params("id")

	var category models.Category
	if err := db.First(&category, categoryID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "分类不存在"})
	}

	// 检查是否有服务关联
	var serviceCount int64
	if err := db.Model(&models.Service{}).Where("category_id = ?", categoryID).Count(&serviceCount).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "查询服务数量失败：" + err.Error()})
	}
	if serviceCount > 0 {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "请先删除该分类下的所有服务"})
	}

	if err := db.Delete(&category).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "删除分类失败：" + err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"success": true})
}

// 管理员登录
func adminLogin(c *fiber.Ctx) error {
	var loginInput struct {
		Password string `json:"password"`
	}

	if err := c.BodyParser(&loginInput); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "需要密码字段"})
	}

	// 检查必填字段
	if loginInput.Password == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "需要密码字段"})
	}

	var auth models.Auth
	if err := db.First(&auth).Error; err != nil {
		log.Println("登录尝试失败：无法获取认证信息")
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "无效凭证"})
	}

	// 验证密码
	if err := bcrypt.CompareHashAndPassword([]byte(auth.PasswordHash), []byte(loginInput.Password)); err != nil {
		log.Println("登录尝试失败：密码错误")
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "无效凭证"})
	}

	// 设置会话
	sess := sessionManager.Get(c)
	sess.Set("authenticated", true)
	sess.Save()

	log.Println("管理员登录成功")
	return c.Status(fiber.StatusOK).JSON(fiber.Map{"success": true})
}

// 管理员登出
func adminLogout(c *fiber.Ctx) error {
	sess := sessionManager.Get(c)
	sess.Set("authenticated", false)
	sess.Save()

	log.Println("管理员登出成功")
	return c.Status(fiber.StatusOK).JSON(fiber.Map{"success": true})
}

// 修改管理员密码
func changePassword(c *fiber.Ctx) error {
	var passwordInput struct {
		OldPassword string `json:"oldPassword"`
		NewPassword string `json:"newPassword"`
	}

	if err := c.BodyParser(&passwordInput); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "需要原密码和新密码字段"})
	}

	// 检查必填字段
	if passwordInput.OldPassword == "" || passwordInput.NewPassword == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "需要原密码和新密码字段"})
	}

	// 验证新密码复杂度
	if len(passwordInput.NewPassword) < 8 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "后端提示：密码长度至少8位"})
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
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "后端提示：必须包含至少一个大写字母"})
	}
	if !hasDigit {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "后端提示：必须包含至少一个数字"})
	}

	var auth models.Auth
	if err := db.First(&auth).Error; err != nil {
		log.Println("密码修改失败：无法获取认证信息")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "获取认证信息失败"})
	}

	// 验证原密码
	if err := bcrypt.CompareHashAndPassword([]byte(auth.PasswordHash), []byte(passwordInput.OldPassword)); err != nil {
		log.Println("密码修改失败：原密码错误")
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "原密码错误"})
	}

	// 更新密码
	newPasswordHash, err := bcrypt.GenerateFromPassword([]byte(passwordInput.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		log.Println("密码修改失败：生成密码哈希失败")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "生成密码哈希失败"})
	}

	auth.PasswordHash = string(newPasswordHash)
	if err := db.Save(&auth).Error; err != nil {
		log.Println("密码修改失败：保存密码哈希失败")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "更新密码失败"})
	}

	// 清除会话，强制重新登录，增强安全性
	sess := sessionManager.Get(c)
	sess.Set("authenticated", false)
	sess.Save()

	log.Println("密码修改成功")
	return c.Status(fiber.StatusOK).JSON(fiber.Map{"success": true})
}
