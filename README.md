# NAS-Nav

A lightweight, customizable navigation page for self-hosted NAS (Network Attached Storage) systems. NAS-Nav provides an elegant interface to organize and access all your self-hosted services in one place.

## Features

- **Service Management**: Add, edit, and organize your NAS services with custom icons and categories
- **Category Filtering**: Group and filter services by category for better organization
- **Search Functionality**: Quickly find services using the built-in search feature
- **Admin Panel**: Secure administration interface to manage services and categories
- **Responsive Design**: Works well on both desktop and mobile devices
- **Lightweight**: Minimal resource usage, perfect for running on NAS devices

## Requirements

- Go 1.21 or higher
- SQLite (included via dependencies)

## Installation

### From Source

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/nas-nav.git
   cd nas-nav
   ```

2. Build the application:
   ```bash
   go build -o nas-nav main.go
   ```

### Pre-built Binary

Download the latest pre-built binary from the [releases page](https://github.com/yourusername/nas-nav/releases) for your operating system.

## Running the Application

### First-Time Setup

Before running the application for the first time, initialize the database:

```bash
./nas-nav -initdb
```

This will create the necessary database structure and set up default admin credentials.

### Starting the Server

To start the NAS-Nav server:

```bash
./nas-nav
```

The server will start on port 5000 by default. You can access the application at http://localhost:5000.

### Command Line Options

```bash
./nas-nav -help       # Show help information
./nas-nav -debug      # Run in debug mode
./nas-nav -initdb     # Initialize the database (overwrites existing data)
```

## Usage

### Accessing the Main Interface

Open a web browser and navigate to http://your-nas-ip:5000 to access the main navigation page. Here you can view all your configured services, filter them by category, and search for specific services.

### Admin Panel

1. Click the "Admin" button on the main page
2. Log in with the admin credentials (default credentials are displayed during first-time setup)
3. Use the admin panel to:
   - Add, edit, and delete services
   - Create and manage service categories
   - Customize service icons and URLs

## Project Structure

```
nas-nav/
├── main.go         # Main application entry point
├── models/         # Data models and database operations
├── static/         # Static assets (CSS, JavaScript, HTML)
│   ├── css/        # Style sheets
│   ├── js/         # JavaScript files
│   └── html/       # HTML templates
├── go.mod          # Go module dependencies
├── go.sum          # Dependency checksums
└── README.md       # Project documentation
```

## Development

If you want to contribute to NAS-Nav or customize it for your needs:

1. Set up your development environment with Go 1.21 or higher
2. Fork and clone the repository
3. Make your changes
4. Test your changes using `go run main.go -debug`
5. Submit a pull request with your improvements

## License

This project is licensed under the Apache License 2.0. See the [LICENSE](LICENSE) file for details.

## Acknowledgements

- [Gin](https://github.com/gin-gonic/gin) - HTTP web framework for Go
- [GORM](https://gorm.io/) - ORM library for Go
- [SQLite](https://www.sqlite.org/) - Embedded database engine
- [MDUI](https://www.mdui.org/) - Material Design UI framework

## Support

If you encounter any issues or have questions about NAS-Nav, please [open an issue](https://github.com/yourusername/nas-nav/issues) on GitHub.
