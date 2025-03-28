import mercadopago from "mercadopago";

const ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN_TEST || "";
if (!ACCESS_TOKEN) {
  console.warn("MERCADOPAGO_ACCESS_TOKEN_TEST não está definido!");
}

mercadopago.configurations.setAccessToken(ACCESS_TOKEN);

export default mercadopago;
