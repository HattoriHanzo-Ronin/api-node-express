# ApiNodeExpress

ApiNodeExpress is a REST API designed for home network device management and network automation.

The project allows storing and managing devices connected to a local network, including custom device names, MAC addresses, and synchronization with supported network repeaters. It also includes FTP-related functionality and is currently being refactored towards a cleaner and more maintainable backend architecture.

---

## Features

- Device registration and management
- MAC address synchronization
- Repeater integration support
- FTP service integration
- Dockerized deployment
- Environment-based configuration
- RESTful API architecture

---

## Tech Stack

- Node.js
- Express.js
- Docker
- Docker Compose
- JavaScript

---

## Current Refactor Focus

The project is currently focused on improving backend architecture and maintainability by:

- Moving business logic into dedicated service layers
- Improving code organization and separation of concerns
- Centralizing error handling
- Improving environment configuration management
- Preparing JWT-based authentication
- Cleaning and documenting the codebase
- Preparing the repository for public release

---

## Project Structure

```bash
src/
├── controllers/
├── services/
├── routes/
├── middleware/
├── models/
├── utils/
└── config/
```

---

## Environment Variables

Create a `.env` file using `.env.example` as reference.

Example:

```env
PORT=3000
JWT_SECRET=your_secret_key

FTP_HOST=localhost
FTP_USER=user
FTP_PASSWORD=password
```

---

## Local Development

Install dependencies:

```bash
pnpm install
```

Run development server:

```bash
pnpm run postgres
```

---

## Docker Setup

Start containers:

```bash
docker compose up --build
```

Stop containers:

```bash
docker-compose down
```

---

## Planned Improvements

- JWT authentication
- Centralized validation system
- API documentation
- Automated testing
- Production-ready Docker configuration
- Additional network automation features

---

## Status

Project currently under active refactor and architecture cleanup.

---

## License

This project is intended for portfolio and educational purposes.
