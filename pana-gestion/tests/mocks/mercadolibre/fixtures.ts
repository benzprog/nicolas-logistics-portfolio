/** Respuestas de ejemplo con la forma que devuelve Mercado Libre. */

export const tokenResponse = {
  access_token: "APP_USR-1234-access",
  token_type: "bearer",
  expires_in: 21600,
  scope: "offline_access read write",
  user_id: 987654321,
  refresh_token: "TG-refresh-nuevo",
};

export const userResponse = {
  id: 987654321,
  nickname: "PANAILUMINACION",
  email: "ventas@pana.com.ar",
  site_id: "MLA",
  permalink: "https://perfil.mercadolibre.com.ar/PANAILUMINACION",
};

export const questionResponse = {
  id: 5036111111,
  seller_id: 987654321,
  item_id: "MLA123456789",
  text: "¿Tienen stock en luz cálida?",
  status: "UNANSWERED",
  date_created: "2026-09-08T10:00:00.000-03:00",
  from: { id: 555000111 },
  answer: null,
};

export const itemResponse = {
  id: "MLA123456789",
  title: "Lámpara LED 9W E27 luz fría",
  thumbnail: "http://http2.mlstatic.com/D_1-O.jpg",
  secure_thumbnail: "https://http2.mlstatic.com/D_1-O.jpg",
  permalink: "https://articulo.mercadolibre.com.ar/MLA-123456789",
  price: 3500,
  currency_id: "ARS",
  available_quantity: 42,
  status: "active",
};

export const notification = {
  _id: "evt_abc123",
  resource: "/questions/5036111111",
  user_id: 987654321,
  topic: "questions",
  application_id: 1234567890,
  attempts: 1,
  sent: "2026-09-08T14:00:00.000-04:00",
  received: "2026-09-08T14:00:00.100-04:00",
};
