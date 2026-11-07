export async function onRequest({ request }) {
  const country = request.cf && typeof request.cf.country === "string"
    ? request.cf.country.toUpperCase()
    : "XX";

  return new Response(JSON.stringify({
    country,
    pricingRegion: country === "IN" ? "IN" : "GLOBAL"
  }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}
