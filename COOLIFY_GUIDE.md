# ☁️ Guía de Despliegue en Coolify

Este proyecto está diseñado para funcionar perfectamente en **Coolify** utilizando Docker Compose. Aquí tienes los pasos clave para un despliegue exitoso.

## 1. Crear un Nuevo Recurso
- Ve a **Projects** > **New Resource**.
- Selecciona **GitHub Repository**.
- Elige el repositorio de tu MusicBot.

## 2. Configuración de Build
- Coolify detectará el archivo `docker-compose.yml`.
- Configura el **Deployment Type** como `Docker Compose`.

## 3. Variables de Entorno (Environment Variables)
- Copia todas las claves del archivo `.env.example`.
- Pega los valores reales (Tokens de Discord, ID de Cliente, etc.).
- Asegúrate de que las variables estén marcadas como **Build Variable** si es necesario, aunque para este proyecto solo necesitan ser variables de ejecución.

## 4. Dominios y Puertos (Crítico)
Para que el bot y la web funcionen correctamente:
- **Web (Dashboard)**: Asigna un dominio (ej: `music.tudominio.com`). Coolify lo conectará automáticamente al puerto 2728 del contenedor `web`.
- **API y WebSockets**: La web necesita comunicarse con el servidor en el puerto `3001`.
  - Si usas **IP Directa**: Asegúrate de que el firewall de tu servidor permita el tráfico en el puerto `3001`.
  - Si usas **Dominio**: Puedes añadir un segundo dominio (ej: `api.tudominio.com`) y decirle a Coolify que lo mapee al puerto `3001`.
  
> [!IMPORTANT]
> **Configuración de WebSockets en Traefik**
> Si usas dominios con el proxy de Coolify (Traefik), los WebSockets deberían funcionar por defecto. Si notas que la web no se sincroniza, asegúrate de que no haya firewalls bloqueando las conexiones persistentes.

## 5. Almacenamiento (Persistent Storage)
- Coolify montará automáticamente los volúmenes definidos en `docker-compose.yml`.
- Esto asegura que tus datos de la cola y configuraciones de Lavalink se mantengan tras los reinicios.

## 6. Resolución de YouTube
- Recuerda que debes configurar tu `refreshToken` en `lavalink/application.yml` en el servidor si quieres que las búsquedas de YouTube funcionen sin errores de "403 Forbidden".
- Ver la sección `plugins.youtube.oauth` en el archivo de configuración.
