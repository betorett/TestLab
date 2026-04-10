# 🧪 TestLab Pro

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Style: Premium](https://img.shields.io/badge/Style-Premium-blueviolet)]

**TestLab** es una plataforma minimalista y potente de exámenes interactivos diseñada para optimizar el estudio mediante la automatización por IA. Convierte tus bancos de preguntas CSV en sesiones de estudio dinámicas con corrección inmediata, historial de intentos e integración directa con modelos de lenguaje como Gemini o Claude.

---

## ✨ Características Principales

- **🎨 Interfaz Premium**: Diseño refinado con transiciones suaves y modo oscuro/claro automático.
- **📚 Historial de Exámenes**: Memoria persistente en el navegador para repetir exámenes anteriores y seguir tu progreso.
- **🤖 Integración con IA**: Generación de reportes detallados para Gemini y botones de consulta rápida para resolver dudas conceptuales al instante.
- **⚡ Carga Flexible**: Sube archivos `.csv` o pega directamente el texto desde el portapapeles.
- **🎯 Sistema de Puntuación Profesional**: Configura penalizaciones por fallo y obtén una nota sobre 10 calculada al estilo oficial.
- **🔄 Modos de Estudio**: Elige entre el **Modo Estudio** (feedback instantáneo) o el **Modo Examen** (simulacro real).

---

## 📂 Formato de Archivos (CSV)

Para que TestLab reconozca tus preguntas, el archivo CSV debe seguir esta estructura simple (usando `;` como separador):

`Pregunta ; Tipo ; Opcion A ; Opcion B ; ... ; RespuestaCorrecta`

### Especificaciones del Formato:
1.  **Pregunta**: El texto de la pregunta.
2.  **Tipo**: 
    - `SINGLE`: Para preguntas de una única respuesta correcta.
    - `MULTIPLE`: Para preguntas donde varias opciones pueden ser correctas (separadas por `|`).
3.  **Opciones**: Puedes añadir tantas como quieras (A, B, C, D...).
4.  **Respuesta Correcta**: La letra o letras mayúsculas de la solución (ej: `A` o `A|C`).

> [!TIP]
> **Ejemplo de línea MULTIPLE:**
> `¿Qué lenguajes son de frontend? ; MULTIPLE ; HTML ; Python ; CSS ; A|C`

---

## 🚀 Instalación y Uso Local

No requiere base de datos ni servidor complejo. Es una **SPA** (Single Page Application) pura.

1.  Clona este repositorio o descarga los archivos.
2.  Inicia un servidor local rápido para evitar restricciones de seguridad de archivos locales:
    ```bash
    npx http-server . -p 8080
    ```
3.  Abre `http://localhost:8080` en tu navegador.

---

## 🛠️ Tecnologías

- **HTML5 & CSS3** (Vanilla para máximo rendimiento).
- **JavaScript ES6+** (Gestión de estado y DOM).
- **PapaParse**: Procesamiento robusto de CSV.
- **LocalStorage**: Persistencia de datos e historial sin base de datos externa.

---

## 📝 Licencia

Este proyecto está bajo la licencia MIT. Siéntete libre de adaptarlo y usarlo para tus estudios.

---
*Hecho con ❤️ para estudiantes que quieren aprovechar la IA.*
