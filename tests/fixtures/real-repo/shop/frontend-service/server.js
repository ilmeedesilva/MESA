const express = require("express");
const axios = require("axios");

const app = express();

app.get("/home", async (req, res) => {
  const products = await axios.get("http://catalog-service:8081/products");
  res.json(products.data);
});

app.post("/checkout", async (req, res) => {
  await fetch("http://order-service:8082/orders");
  res.status(202).send();
});
