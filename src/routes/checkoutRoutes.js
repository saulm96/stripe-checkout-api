import { Router } from "express";
import {
  validateCheckoutData,
  loadProductInfo,
} from "../middlewares/validation.js";
import checkoutController from "../controllers/checkoutController.js";
import express from "express";

const router = Router();

// POST: Crear Checkout Session
router.post(
  "/create-checkout-session",
  validateCheckoutData,
  loadProductInfo,
  checkoutController.createCheckoutSession
);

// GET: Verificar estado de checkout session
router.get("/session-status/:session_id", checkoutController.getCheckoutStatus);

// GET: Obtener información del producto
router.get("/products/:id", checkoutController.getProductInfo);

// POST: Webhook de Stripe (Raw body necesario)
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  checkoutController.handleWebhook
);

export default router;
