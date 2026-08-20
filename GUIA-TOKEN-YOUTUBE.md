# 🎵 Guía para Obtener Token de YouTube (Método Simple)

Este es el método más confiable usando la documentación oficial del plugin de YouTube para Lavalink.

---

## 📋 Método 1: Usando el Repositorio Oficial (Recomendado)

1. **Ve al repositorio oficial**:
   - Abre GitHub y visita: [https://github.com/lavalink-devs/youtube-source](https://github.com/lavalink-devs/youtube-source)

2. **Busca la sección de OAuth**:
   - En el README, busca la sección titulada "OAuth" o "Authentication"
   - Allí encontrarás el enlace actualizado para obtener el token

3. **Sigue las instrucciones**:
   - Haz clic en el enlace de autorización
   - Inicia sesión con tu cuenta de Google
   - Copia el `refresh_token` que te proporcionen

---

## 📋 Método 2: Método Manual Paso a Paso

Si el método anterior no funciona, usa este:

### PASO 1: Crea un proyecto en Google Cloud Console

1. Ve a [https://console.cloud.google.com/](https://console.cloud.google.com/)
2. Crea un nuevo proyecto (o usa uno existente)
3. Habilita la **YouTube Data API v3**
4. Ve a "Credentials" → "Create Credentials" → "OAuth client ID"
5. Selecciona "Desktop app" como tipo de aplicación
6. Guarda el Client ID y Client Secret que obtengas

### PASO 2: Obtén el código de autorización

Abre esta URL en tu navegador (reemplaza `TU_CLIENT_ID`):
```
https://accounts.google.com/o/oauth2/v2/auth?client_id=TU_CLIENT_ID&redirect_uri=urn:ietf:wg:oauth:2.0:oob&response_type=code&scope=https://www.googleapis.com/auth/youtube&access_type=offline&prompt=consent
```

### PASO 3: Intercambia el código por el refresh token

Usa curl, Postman, o cualquier herramienta para hacer una solicitud POST a:
```
https://oauth2.googleapis.com/token
```

Con estos parámetros (x-www-form-urlencoded):
```
client_id=TU_CLIENT_ID
client_secret=TU_CLIENT_SECRET
code=EL_CODIGO_OBTENIDO
grant_type=authorization_code
redirect_uri=urn:ietf:wg:oauth:2.0:oob
```

### PASO 4: Usa el refresh token

La respuesta contendrá un campo `refresh_token`. ¡Ese es el que necesitas!

---

## 🔑 Cuando tengas el token:

1. Ve a la configuración de tu aplicación en Coolify
2. Actualiza la variable `YOUTUBE_REFRESH_TOKEN`
3. Redeploya tu aplicación

---

## 💡 Consejo Rápido:

Si solo necesitas que funcione YA, prueba primero **solo con la configuración que actualicé** (los clientes adicionales). A veces solo con eso funciona para videos que no requieren autenticación fuerte.
