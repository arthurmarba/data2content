import mercadopago from "mercadopago";

const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || "";
if (!ACCESS_TOKEN) {
  console.warn("MP_ACCESS_TOKEN não está definido!");
}

mercadopago.configurations.setAccessToken(ACCESS_TOKEN);

export default mercadopago;
