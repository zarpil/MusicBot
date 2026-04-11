# 🎵 MusicBot Dashboard

Un bot de música para Discord potente, moderno y con un panel web interactivo diseñado para una experiencia de usuario premium.

![Dashboard Preview](https://img.shields.io/badge/Status-Ready-brightgreen)
![Tech](https://img.shields.io/badge/Node.js-20-blue)
![Tech](https://img.shields.io/badge/React-19-blue)
![Tech](https://img.shields.io/badge/Lavalink-v4-orange)

## ✨ Características Principales

- 🚀 **Panel Web Moderno**: Controla la música desde tu navegador con una interfaz estilo glassmorphism.
- ↕️ **Drag & Drop**: Reordena la cola de reproducción simplemente arrastrando las canciones.
- 🔍 **Búsqueda en Tiempo Real**: Busca canciones en YouTube, Spotify y SoundCloud mientras escribes.
- ⚡ **Respuesta Inmediata**: Sistema de WebSockets para una sincronización perfecta entre Discord y la Web.
- ⏸️ **Control Total**: Pausa, salta, ajusta el volumen y busca momentos específicos (seek) con un click.
- 📦 **Docker Ready**: Despliegue sencillo en cualquier servidor con `docker-compose`.

---

## 🚀 Instalación Local

1. **Clonar el repositorio**:
   ```bash
   git clone https://github.com/zarpil/MusicBot.git
   cd MusicBot
   ```

2. **Configurar el entorno**:
   - Copia `.env.example` a `.env` y rellena tus credenciales de Discord.
   - Copia `lavalink/application.yml.example` a `lavalink/application.yml`.

3. **Lanzar con Docker**:
   ```bash
   docker-compose up -d
   ```

El panel estará disponible en `http://localhost:2728` y la API en el puerto `3001`.

---

## ☁️ Despliegue en Coolify

Este proyecto está optimizado para **Coolify**:
1. Conecta tu repositorio de GitHub.
2. Selecciona **Docker Compose** como tipo de despliegue.
3. Copia las variables de `.env.example` a la sección **Environment Variables** de Coolify.
4. Asegúrate de exponer los puertos `2728` (Web) y `3001` (API/WebSocket).

Ver más detalles en [COOLIFY_GUIDE.md](./COOLIFY_GUIDE.md).

---

## 🛠 Tecnologías

- **Backend**: Node.js, Express, Better-SQLite3.
- **Frontend**: React 19, Vite, Tailwind CSS, Zustand.
- **Audio**: Lavalink v4 + YouTube Plugin.
- **Comunicaciones**: WebSockets (ws).

---

## 📄 Licencia

Este proyecto es privado. Todos los derechos reservados.
