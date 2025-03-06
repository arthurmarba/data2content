// src/app/lib/mercadopago.js
const mercadopago = require("mercadopago");

// Use a versão 1.x que aceita configurations.setAccessToken
const ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN_TEST || "";

// Ajuste via .configurations.setAccessToken
mercadopago.configurations.setAccessToken(ACCESS_TOKEN);

module.exports = mercadopago;
